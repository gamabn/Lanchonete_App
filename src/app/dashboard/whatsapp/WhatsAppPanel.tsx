"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
} from "lucide-react";
import type { WhatsAppState } from "@/app/util/whatsappTypes";
import {
  initialConnectionView,
  WhatsAppConnectionController,
  type ActionBlockReason,
} from "./connectionController";
import { localQRGeometry } from "./localQR";

const labels: Record<WhatsAppState, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando",
  qr_required: "Aguardando QR",
  connected: "Conectado",
  reconnecting: "Reconectando",
  error: "Erro na conexão",
  legacy_active: "Modo de desenvolvimento ativo",
};

const blockedMessages: Record<ActionBlockReason, string> = {
  disposed: "O controlador deste painel foi encerrado. Recarregue a página para continuar.",
  expired: "Sua sessão expirou. Entre novamente para continuar.",
  hidden: "A ação foi bloqueada porque a atualização está pausada. Atualize o status para retomar.",
  busy: "Já existe uma operação em andamento. Aguarde sua conclusão e tente novamente.",
};

export function WhatsAppPanel({
  ownerId,
  onExpired,
}: {
  ownerId: string;
  onExpired: () => void;
}) {
  const [view, setView] = useState(initialConnectionView);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const controller = useRef<WhatsAppConnectionController | null>(null);
  const expiredCallback = useRef(onExpired);
  expiredCallback.current = onExpired;

  useEffect(() => {
    setView(initialConnectionView());
    setInteractionError(null);
    const current: WhatsAppConnectionController = new WhatsAppConnectionController(
      ownerId,
      (next) => {
        if (controller.current !== current) {
          console.log("[whatsapp:H12.1] panel.stale-update", current.diagnostics());
          return;
        }
        setView(next);
      },
      () => expiredCallback.current(),
      { visible: !document.hidden },
    );
    controller.current = current;
    console.log("[whatsapp:H12.1] panel.mount", current.diagnostics());
    const visibility = () => {
      console.log("[whatsapp:H12.1] panel.visibility", current.diagnostics());
      current.setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    void current.refresh();
    return () => {
      console.log("[whatsapp:H12.1] panel.cleanup", {
        isCurrent: controller.current === current, ...current.diagnostics(),
      });
      document.removeEventListener("visibilitychange", visibility);
      current.dispose();
      if (controller.current === current) controller.current = null;
    };
  }, [ownerId]);
  
  const geometry = useMemo(() => {
    if (!view.qr?.qr) return null;
    try {
      return localQRGeometry(view.qr.qr);
    } catch {
      return null;
    }
  }, [view.qr?.qr]);

  const phase = view.connection?.status;

  const connected = phase === "connected",

    legacy = phase === "legacy_active";

  const progressing =
    phase === "connecting" ||
    phase === "reconnecting" ||
    phase === "qr_required";
  const blockedReason = view.expired
    ? "session_expired"
    : view.busy
      ? "action_in_progress"
      : view.loading
        ? "status_loading"
        : undefined;
  const disabled = Boolean(blockedReason);
  const renderedControllerId = controller.current?.diagnostics().instanceId ?? null;
  const run = async (action: "connect" | "disconnect" | "refresh", buttonDisabled: boolean) => {
    const current = controller.current;
    // Temporary browser trace: primitive state only; do not log ownerId, QR, JWT or requests.
    console.log("[whatsapp:H12.1] panel.click", {
      action, buttonDisabled, renderedControllerId,
      hasController: Boolean(current),
      react: { loading: view.loading, expired: view.expired, paused: view.paused, busy: view.busy },
      controller: current?.diagnostics() ?? null,
    });
    setInteractionError(null);
    if (!current) {
      console.log("[whatsapp:H12.1] panel.blocked", { action, reason: "missing_controller" });
      setInteractionError("O painel ainda não está pronto. Recarregue a página e tente novamente.");
      return;
    }
    const reportBlock = (reason: ActionBlockReason) => {
      if (controller.current !== current) return;
      // Reconcile a stale React view with the exact controller that rejected this click.
      const latest = current.getView();
      setView(current.diagnostics().disposed ? { ...latest, loading: false, busy: null } : latest);
      setInteractionError(blockedMessages[reason]);
    };
    try {
      // An explicit interaction resumes the controller even if a visibility event was missed.
      current.setVisible(true, false);
      if (action === "refresh") {
        const state = current.diagnostics();
        const reason = state.disposed ? "disposed" : state.expired ? "expired" : state.busy ? "busy" : null;
        if (reason) {
          console.log("[whatsapp:H12.1] panel.blocked", { action, reason, ...state });
          reportBlock(reason);
          return;
        }
        await current.refresh(true);
      } else {
        const result = await current.act(action);
        if (result?.accepted === false) reportBlock(result.reason);
      }
    } catch {
      console.log("[whatsapp:H12.1] panel.action-error", { action, ...current.diagnostics() });
      if (controller.current === current)
        setInteractionError("Não foi possível executar a ação no painel. Recarregue a página e tente novamente.");
    }
  };
  const disconnect = () => {
    if (
      window.confirm(
        "Desconectar o WhatsApp desta lanchonete? O atendimento será pausado e você poderá reconectar mantendo a sessão.",
      )
    )
      void run("disconnect", false);
  };

  return (
    <main className="min-h-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Smartphone size={18} /> Atendimento da lanchonete
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            WhatsApp
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Conecte o número da sua lanchonete e acompanhe o atendimento pelo
            painel.
          </p>
        </header>
        <section
          data-whatsapp-diagnostic="h12.1-click-v1"
          data-controller-ready={Boolean(controller.current)}
          data-paused={view.paused}
          aria-busy={view.loading || Boolean(view.busy)}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          aria-label="Conexão WhatsApp"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Sua conexão</h2>
              <p className="mt-1 text-sm text-slate-500">
                O status é atualizado enquanto esta página estiver ativa.
              </p>
            </div>
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${connected ? "bg-emerald-50 text-emerald-700" : phase === "error" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}
            >
              {view.loading ||
              view.busy ||
              phase === "connecting" ||
              phase === "reconnecting" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : connected ? (
                <CheckCircle2 size={16} />
              ) : (
                <Smartphone size={16} />
              )}
              {view.loading
                ? "Consultando conexão"
                : view.expired
                  ? "Sessão expirada"
                  : view.paused
                    ? "Atualização pausada"
                    : phase
                      ? labels[phase]
                      : "Status indisponível"}
            </span>
          </div>

          {view.paused && (
            <p className="mt-5 text-sm text-slate-600">
              A atualização automática está pausada enquanto a página está
              oculta. Use Atualizar status para retomar.
            </p>
          )}
          {(interactionError || view.error) && (
            <div
              role="alert"
              className="mt-5 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"
            >
              <CircleAlert size={19} className="shrink-0" />
              <div>
                {interactionError || view.error}
                {view.expired && (
                  <Link
                    href="/auth/login"
                    className="ml-2 font-semibold underline"
                  >
                    Entrar novamente
                  </Link>
                )}
              </div>
            </div>
          )}
          {legacy && !view.error && (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Esta conexão está sendo atendida pelo modo de desenvolvimento.
              Encerre esse modo antes de usar o painel.
            </p>
          )}
          {connected && (
            <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-emerald-900">
              <p className="font-semibold">WhatsApp conectado</p>
              <p className="mt-1 text-sm">
                As mensagens recebidas serão atendidas pela sua lanchonete.
              </p>
            </div>
          )}

          {phase === "qr_required" && !view.expired && (
            <div className="mt-6 grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[280px_1fr] sm:items-center">
              <div className="mx-auto flex h-[280px] w-full max-w-[280px] items-center justify-center rounded-xl bg-white">
                {geometry ? (
                  <svg
                    role="img"
                    aria-label="QR Code temporário para conectar o WhatsApp desta lanchonete"
                    viewBox={`0 0 ${geometry.size} ${geometry.size}`}
                    className="h-full w-full"
                    shapeRendering="crispEdges"
                  >
                    <rect
                      width={geometry.size}
                      height={geometry.size}
                      fill="#fff"
                    />
                    <path d={geometry.path} fill="#000" />
                  </svg>
                ) : (
                  <div
                    role="status"
                    className="p-5 text-center text-sm text-slate-500"
                  >
                    <QrCode className="mx-auto mb-3" size={30} />
                    {view.qr?.qr
                      ? "Não foi possível exibir o QR. Atualize o status."
                      : "Aguardando um QR atualizado…"}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Conecte seu aparelho
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  No WhatsApp do restaurante, abra a opção de conectar um
                  aparelho e escaneie este código.
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  O QR é temporário e será atualizado automaticamente. Use
                  apenas o número desta lanchonete e mantenha esta página
                  aberta.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              data-disabled-reason={
                blockedReason ??
                (connected
                  ? "connected"
                  : progressing
                    ? "connecting"
                    : legacy
                      ? "legacy_active"
                      : undefined)
              }
              disabled={disabled || connected || progressing || legacy}
              onClick={(event) => void run("connect", event.currentTarget.disabled)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Smartphone size={18} />
              {view.busy === "connect" ? "Conectando…" : "Conectar WhatsApp"}
            </button>
            <button
              type="button"
              data-disabled-reason={
                blockedReason ??
                (!phase
                  ? "status_unknown"
                  : phase === "disconnected"
                    ? "disconnected"
                    : legacy
                      ? "legacy_active"
                      : undefined)
              }
              disabled={
                disabled || !phase || phase === "disconnected" || legacy
              }
              onClick={disconnect}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Unplug size={18} />
              {view.busy === "disconnect"
                ? "Desconectando…"
                : "Desconectar WhatsApp"}
            </button>
            <button
              type="button"
              aria-label="Atualizar status"
              data-disabled-reason={blockedReason}
              disabled={disabled}
              onClick={(event) => void run("refresh", event.currentTarget.disabled)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={17} />
              {view.loading ? "Atualizando status…" : "Atualizar status"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
