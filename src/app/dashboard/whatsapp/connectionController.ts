import {
  parseWhatsAppSnapshot,
  safeWhatsAppCode,
  whatsappErrorMessage,
  type WhatsAppQR,
  type WhatsAppSnapshot,
} from "@/app/util/whatsappTypes";

export interface ConnectionView {
  connection: WhatsAppSnapshot | null;
  qr: WhatsAppQR | null;
  loading: boolean;
  paused: boolean;
  busy: "connect" | "disconnect" | null;
  error: string | null;
  expired: boolean;
}
export const initialConnectionView = (): ConnectionView => ({
  connection: null,
  qr: null,
  loading: true,
  paused: false,
  busy: null,
  error: null,
  expired: false,
});
export type ActionBlockReason = "disposed" | "expired" | "hidden" | "busy";
export type ActionResult = { accepted: true } | { accepted: false; reason: ActionBlockReason };
let nextControllerId = 0;

interface Dependencies {
  fetch?: typeof fetch;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
  visible?: boolean;
}
class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Ephemeral per-page state. No token, localStorage, tenant selector or automatic POST retries. */
export class WhatsAppConnectionController {
  private readonly instanceId = ++nextControllerId;
  private state = initialConnectionView();
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly schedule: NonNullable<Dependencies["schedule"]>;
  private readonly cancel: NonNullable<Dependencies["cancel"]>;
  private visible: boolean;
  private disposed = false;
  private revision = 0;
  private failures = 0;
  private actionError: string | null = null;
  private restaurantId?: string;
  private request?: AbortController;
  private timer?: unknown;
  private expiryTimer?: unknown;
  constructor(
    _ownerId: string,
    private readonly changed: (view: ConnectionView) => void,
    private readonly expired: () => void,
    dependencies: Dependencies = {},
  ) {
    // Native browser fetch must not receive the controller instance as its `this`.
    this.fetcher = dependencies.fetch ?? globalThis.fetch.bind(globalThis);

    this.now = dependencies.now ?? Date.now;

    this.schedule =
      dependencies.schedule ??
      ((callback, delay) => setTimeout(callback, delay));

    this.cancel =
      dependencies.cancel ??
      ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
      
    this.visible = dependencies.visible ?? true;
    this.state.paused = !this.visible;
  }
  // Temporary H.12.1 browser diagnostics. Never include IDs, tokens, QR or response bodies.
  diagnostics() {
    return {
      instanceId: this.instanceId,
      disposed: this.disposed,
      expired: this.state.expired,
      visible: this.visible,
      busy: this.state.busy,
      loading: this.state.loading,
      paused: this.state.paused,
      inFlight: Boolean(this.request),
      documentHidden: typeof document === "undefined" ? null : document.hidden,
    };
  }
  getView(): ConnectionView { return { ...this.state }; }
  private publish() {
    if (!this.disposed) this.changed({ ...this.state });
  }
  private current(version: number) {
    return (
      !this.disposed &&
      !this.state.expired &&
      this.visible &&
      version === this.revision
    );
  }
  private clearQR() {
    if (this.expiryTimer !== undefined) this.cancel(this.expiryTimer);
    this.expiryTimer = undefined;
    this.state.qr = null;
  }
  private invalidate() {
    this.revision++;
    this.request?.abort();
    this.request = undefined;
    if (this.timer !== undefined) this.cancel(this.timer);
    this.timer = undefined;
    this.clearQR();
  }
  private sessionExpired() {
    this.invalidate();
    this.state = {
      ...initialConnectionView(),
      loading: false,
      expired: true,
      error: whatsappErrorMessage("UNAUTHORIZED"),
    };
    this.publish();
    this.expired();
  }
  // The authenticated backend establishes the tenant; the Context ID only keys the page lifecycle.
  private sameOwner(id: unknown) {
    if (
      typeof id !== "string" ||
      (this.restaurantId && id.toLowerCase() !== this.restaurantId)
    )
      throw new RequestFailure(503, "TENANT_MISMATCH");
    this.restaurantId = id.toLowerCase();
  }
  private async read(
    action: string,
    method: "GET" | "POST",
    controller: AbortController,
    operation: (value: string) => void = () => {},
  ): Promise<unknown> {
    operation("AbortSignal.timeout(15000)");
    const timeout = AbortSignal.timeout(15000);
    operation("AbortSignal.any([controller.signal, timeout])");
    const signal = AbortSignal.any([controller.signal, timeout]);
    operation("construct fetch RequestInit");
    const options: RequestInit = {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal,
    };
    operation("fetch(url, options)");
    const response = await this.fetcher(`/api/whatsapp/${action}`, options);
    operation("response.json()");
    const data = await response.json().catch(() => ({}));
    operation("check response.ok/status");
    if (!response.ok)
      throw new RequestFailure(
        response.status,
        response.status === 401
          ? "UNAUTHORIZED"
          : safeWhatsAppCode(data?.error),
      );
    return data;
  }
  private applySnapshot(data: unknown) {
    let snapshot: WhatsAppSnapshot;
    try {
      snapshot = parseWhatsAppSnapshot(data);
    } catch {
      throw new RequestFailure(503, "INVALID_WHATSAPP_RESPONSE");
    }
    this.sameOwner(snapshot.restaurant_id);
    this.state.connection = snapshot;
    if (
      ["connected", "connecting", "qr_required", "reconnecting"].includes(
        snapshot.status,
      )
    )
      this.actionError = null;
    this.state.error = snapshot.error
      ? whatsappErrorMessage(snapshot.error)
      : snapshot.status === "error"
        ? whatsappErrorMessage("WHATSAPP_UNAVAILABLE")
        : this.actionError;
    if (snapshot.status !== "qr_required" || !snapshot.qr_available)
      this.clearQR();
    return snapshot;
  }
  private handleError(error: unknown) {
    this.clearQR();
    if (error instanceof RequestFailure && error.status === 401) {
      this.sessionExpired();
      return;
    }
    this.failures++;
    this.state.error =
      error instanceof RequestFailure && error.status === 403
        ? "Você não tem permissão para gerenciar esta conexão."
        : whatsappErrorMessage(
            error instanceof RequestFailure
              ? error.code
              : error instanceof Error && error.name === "TimeoutError"
                ? "WHATSAPP_TIMEOUT"
                : "WHATSAPP_UNAVAILABLE",
          );
  }
  private next(delay?: number) {
    if (this.disposed || this.state.expired || !this.visible || this.request)
      return;
    if (this.timer !== undefined) this.cancel(this.timer);
    const phase = this.state.connection?.status;
    const interval = this.failures
      ? Math.min(5000 * 2 ** (this.failures - 1), 60000)
      : phase && ["connecting", "qr_required", "reconnecting"].includes(phase)
        ? 3000
        : phase === "error" || phase === "legacy_active"
          ? 30000
          : 15000;
    this.timer = this.schedule(() => {
      this.timer = undefined;
      void this.refresh();
    }, delay ?? interval);
  }
  async refresh(manual = false): Promise<void> {
    if (this.disposed || this.state.expired || this.state.busy) return;
    if (!this.visible) {
      this.state.loading = false;
      this.publish();
      return;
    }
    // A user refresh supersedes a background GET instead of silently ignoring the click.
    if (this.request && !manual) return;
    if (manual) this.invalidate();
    if (manual || !this.state.connection) {
      this.state.loading = true;
      this.publish();
    }
    if (this.timer !== undefined) this.cancel(this.timer);
    this.timer = undefined;
    const version = ++this.revision,
      controller = new AbortController();
    this.request = controller;
    try {
      const raw = await this.read("status", "GET", controller);
      if (!this.current(version)) return;
      const snapshot = this.applySnapshot(raw);
      if (snapshot.status === "qr_required" && snapshot.qr_available) {
        const rawQR = await this.read("qr", "GET", controller);
        if (!this.current(version)) return;
        const qr = rawQR as Partial<WhatsAppQR> | null;
        this.sameOwner(qr?.restaurant_id);
        this.clearQR();
        if (qr?.qr != null) {
          if (
            typeof qr.qr !== "string" ||
            qr.qr.length > 4096 ||
            typeof qr.expires_at !== "string" ||
            !Number.isFinite(Date.parse(qr.expires_at))
          )
            throw new Error("Invalid QR");
          const remaining = Math.min(
            Date.parse(qr.expires_at) - this.now(),
            60000,
          );
          if (remaining > 0) {
            this.state.qr = qr as WhatsAppQR;
            this.expiryTimer = this.schedule(() => {
              this.expiryTimer = undefined;
              this.state.qr = null;
              this.publish();
            }, remaining);
          }
        }
      }
      this.failures = 0;
    } catch (error) {
      if (this.current(version)) this.handleError(error);
    } finally {
      if (version === this.revision && !this.disposed) {
        this.request = undefined;
        this.state.loading = false;
        this.publish();
        this.next();
      }
    }
  }
  async act(action: "connect" | "disconnect"): Promise<ActionResult> {
    console.log("[whatsapp:H12.1] act.enter", { action, ...this.diagnostics() });
    const blockers: ActionBlockReason[] = [];
    if (this.disposed) blockers.push("disposed");
    if (this.state.expired) blockers.push("expired");
    if (!this.visible) blockers.push("hidden");
    if (this.state.busy) blockers.push("busy");
    if (blockers.length) {
      console.log("[whatsapp:H12.1] act.blocked", { action, blockers, ...this.diagnostics() });
      return { accepted: false, reason: blockers[0]! };
    }
    this.invalidate();
    const version = this.revision,
      controller = new AbortController();
    this.request = controller;
    this.state.busy = action;
    this.state.error = null;
    this.actionError = null;
    this.publish();
    let operation = "read()";
    try {
      console.log("[whatsapp:H12.1] act.request", { action, ...this.diagnostics() });
      const data = await this.read(action, "POST", controller, value => { operation = value; });
      operation = "current(version)";
      if (!this.current(version)) {
        console.log("[whatsapp:H12.1] act.obsolete", { action, ...this.diagnostics() });
        return { accepted: true };
      }
      operation = "applySnapshot(data)";
      this.applySnapshot(data);
      this.failures = 0;
    } catch (error) {
      console.log("[whatsapp:H12.1] act.failed", {
        action,
        operation,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        ...this.diagnostics(),
      });
      if (this.current(version)) {
        this.handleError(error);
        this.actionError = this.state.error;
      }
    } finally {
      if (version === this.revision && !this.disposed) {
        this.request = undefined;
        this.state.busy = null;
        this.state.loading = false;
        this.publish();
        this.next(0);
      }
    }
    return { accepted: true };
  }
  setVisible(visible: boolean, refreshOnResume = true) {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    this.state.paused = !visible;
    if (!visible) {
      this.invalidate();
      this.state.busy = null;
      this.state.loading = false;
      this.publish();
    } else {
      this.publish();
      if (refreshOnResume) void this.refresh();
    }
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
    console.log("[whatsapp:H12.1] controller.dispose", this.diagnostics());
  }
}
