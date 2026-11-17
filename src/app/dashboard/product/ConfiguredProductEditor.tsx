"use client";

import { formReviewTarget, issueReviewTarget, safeProductMessage, type ReviewTarget } from "./productReview";
import CategoryField from "./CategoryField";
import { categoryValue } from "./productCategory";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { requestProduct, ProductRequestError, type PublicationValidation, type Configuration } from "./configuredProductClient";
import { SavePrivateTemplate } from "./PrivateTemplateControls";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button = "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50";
const section = "space-y-4 border-b border-slate-200 pb-6";
const title = "font-semibold text-slate-900";
const label = "block space-y-1 text-sm font-medium text-slate-700";
const editorSections = [
  ["information", "Informações do produto"],
  ["sizes", "Tamanhos e preços"],
  ["customizations", "Personalizações"],
  ["publication", "Imagem e publicação"],
  ["management", "Gerenciar produto"],
] as const;
type EditorSection = typeof editorSections[number][0];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

class ReviewInputError extends Error {
  constructor(error: unknown, readonly target: ReviewTarget) {
    super(error instanceof Error ? error.message : "Revise os campos desta seção.");
  }
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function price(data: FormData, name: string) {
  const value = text(data, name).replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error("Informe um preço não negativo com até duas casas decimais.");
  }
  return value;
}

function bounds(data: FormData, prefix: string) {
  const minSelect = Number(text(data, `${prefix}-min`));
  const maxSelect = Number(text(data, `${prefix}-max`));
  if (!Number.isInteger(minSelect) || !Number.isInteger(maxSelect) || minSelect < 0 || minSelect > maxSelect || maxSelect > 100) {
    throw new Error("Os limites devem ser inteiros entre 0 e 100, com mínimo menor ou igual ao máximo.");
  }
  return { minSelect, maxSelect };
}

function BoundFields({ prefix, min, max, form }: { prefix: string; min: number; max: number; form?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className={label}>Mínimo
        <input className={input} form={form} name={`${prefix}-min`} type="number" min={0} max={100} step={1} defaultValue={min} required />
      </label>
      <label className={label}>Máximo
        <input className={input} form={form} name={`${prefix}-max`} type="number" min={0} max={100} step={1} defaultValue={max} required />
      </label>
    </div>
  );
}

type Option = Configuration["groups"][number]["options"][number];

function OptionForm({ groupId, option, disabled, onSave, onDirty }: {
  groupId: string;
  option?: Option;
  disabled: boolean;
  onDirty: (changed: boolean) => void;
  onSave: (url: string, method: "POST" | "PATCH", body: () => object, afterSave?: () => void) => void;
}) {
  return (
    <form onChangeCapture={(event) => {
      const data = new FormData(event.currentTarget);
      onDirty(
        text(data, "name") !== (option?.name ?? "") ||
        Number(text(data, "price").replace(",", ".")) !== (option?.additionalPrice ?? 0) ||
        (Boolean(option) && data.has("available") !== (option?.available === true)),
      );
    }} onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      onSave(
        option ? `/api/product/options/${encodeURIComponent(option.id)}` : "/api/product/options",
        option ? "PATCH" : "POST",
        () => {
          const fields = { name: text(data, "name"), additionalPrice: Number(price(data, "price")) };
          return option ? { ...fields, available: data.has("available") } : { ...fields, groupId };
        },
        option ? undefined : () => form.reset(),
      );
    }}>
      <fieldset disabled={disabled} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto_auto]">
        <label className={label}>{option ? "Nome da opção" : "Nova opção"}
          <input className={input} name="name" defaultValue={option?.name ?? ""} required />
        </label>
        <label className={label}>Adicional (R$)
          <input className={input} name="price" inputMode="decimal" defaultValue={String(option?.additionalPrice ?? 0)} required />
        </label>
        {option && <label className="flex items-center gap-2 self-center text-sm"><input name="available" type="checkbox" defaultChecked={option.available === true} /> Ativa</label>}
        <button className={button} type="submit">{option ? "Salvar opção e adicional" : "Adicionar opção"}</button>
      </fieldset>
    </form>
  );
}

export default function ConfiguredProductEditor({ configuration, onRefresh, onBusy, onDeleted, onPendingChange, categories = [] }: {
  configuration: Configuration;
  categories?: string[];
  onRefresh: (configuration: Configuration) => void;
  onBusy: (busy: boolean) => void;
  onDeleted?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { product, variants, groups } = configuration;
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [noticeRecord, setNoticeRecord] = useState<{ productId: string; message: string; error: boolean; target?: ReviewTarget }>();
  const notice = noticeRecord?.productId === product.id ? noticeRecord : undefined;
  function setNotice(value: { message: string; error: boolean; target?: ReviewTarget } | undefined) {
    setNoticeRecord(value ? { ...value, productId: product.id } : undefined);
  }
  const [lastSave, setLastSave] = useState<{ productId: string; target: ReviewTarget }>();
  const [operation, setOperation] = useState<{ productId: string; kind: "save" | "refresh" | "delete" | "model"; target: ReviewTarget }>();
  const [modelPending, setModelPending] = useState(false);
  const [savedRevision, setSavedRevision] = useState(0);
  const [validationRecord, setValidationRecord] = useState<{ productId: string; result: PublicationValidation }>();
  const validation = validationRecord?.productId === product.id ? validationRecord.result : undefined;
  function setValidation(value: PublicationValidation | undefined) {
    setValidationRecord(value ? { productId: product.id, result: value } : undefined);
  }
  const [publicationAction, setPublicationAction] = useState<"validating" | "publishing">();
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sectionSelection, setSectionSelection] = useState<{ productId: string; section: EditorSection }>({ productId: product.id, section: "information" });
  const dirty = useRef(new Set<string>());
  const templatePending = useRef(false);
  const lock = useRef(false);
  const afterRefresh = useRef<(() => void) | undefined>(undefined);
  const editorRoot = useRef<HTMLDivElement | null>(null);
  const configurationUrl = `/api/product/${encodeURIComponent(product.id)}/configuration`;
  const disabled = busy || needsRefresh;
  const configurationFormId = `product-configuration-${product.id}`;

  const activeSection = sectionSelection.productId === product.id ? sectionSelection.section : "information";
  function activateSection(section: EditorSection) {
    setSectionSelection(current => current.productId === product.id && current.section === section
      ? current : { productId: product.id, section });
  }
  function navigateSection(section: EditorSection) {
    activateSection(section);
    const target = editorRoot.current?.querySelector<HTMLElement>(`[data-editor-section="${section}"]`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }

  function revealGroup(target: ReviewTarget) {
    if (!target.groupId || !groups.some(group => group.id === target.groupId)) return;
    setCollapsedGroups(current => { const next = new Set(current); next.delete(target.groupId!); return next; });
  }
  function visitIssue(target: ReviewTarget) {
    revealGroup(target);
    if (target.section === "customizations" && target.groupId && groups.some(group => group.id === target.groupId)) {
      const group = editorRoot.current?.querySelector<HTMLElement>(`[data-review-group="${target.groupId}"]`);
      const content = group?.querySelector<HTMLElement>("[data-group-content]");
      if (content) content.hidden = false;
      activateSection("customizations");
      group?.focus({ preventScroll: true });
      group?.scrollIntoView({ block: "start" });
      return;
    }
    if (target.section === "publication" && target.label !== "Imagem do produto") {
      const validationArea = editorRoot.current?.querySelector<HTMLElement>("[data-review-validation]");
      if (validationArea) {
        activateSection("publication");
        validationArea.focus({ preventScroll: true });
        validationArea.scrollIntoView({ block: "start" });
        return;
      }
    }
    navigateSection(target.section);
  }
  function showError(error: unknown, fallback: string, target: ReviewTarget) {
    const message = safeProductMessage(error instanceof Error ? error.message : undefined, fallback);
    const related = issueReviewTarget(message, configuration, error instanceof ReviewInputError ? error.target : target);
    revealGroup(related);
    setNotice({ message, error: true, target: related });
  }

  async function deleteDraft() {
    if (lock.current || needsRefresh || dirty.current.size || templatePending.current || product.published) return;
    if (!window.confirm(`Excluir definitivamente o rascunho "${product.name}"? Produtos com pedidos não serão excluídos.`)) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setOperation({ productId: product.id, kind: "delete", target: { section: "management" } });
    setNotice(undefined);
    try {
      await requestProduct("/api/product", "Não foi possível excluir o rascunho.", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      onDeleted?.();
    } catch (error) {
      showError(error, "Não foi possível excluir o rascunho.", { section: "management" });
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      setOperation(undefined);
    }
  }
  function markDirty(key: string) {
    dirty.current.add(key);
    setDirtyForms(new Set(dirty.current));
    onPendingChange?.(dirty.current.size > 0 || templatePending.current);
    setValidation(undefined);
  }

  function markClean(key: string) {
    dirty.current.delete(key);
    setDirtyForms(new Set(dirty.current));
    onPendingChange?.(dirty.current.size > 0 || templatePending.current);
  }

  function trackConfiguration() {
    const form = editorRoot.current?.querySelector<HTMLFormElement>(`form[id="${configurationFormId}"]`);
    if (!form) { markDirty("configuration"); return; }
    const data = new FormData(form);
    const sameNumber = (name: string, saved: number | string) => {
      const value = text(data, name).replace(",", ".");
      return value !== "" && Number(value) === Number(saved);
    };
    let changed = true;
    try {
      changed = text(data, "name") !== product.name.trim() || text(data, "description") !== (product.description ?? "").trim() ||
        categoryValue(String(data.get("category") ?? "")) !== (product.category ?? null) || data.has("available") !== (product.available === true) ||
        groups.some(group => text(data, `group-${group.id}-name`) !== group.name.trim() || data.has(`${group.id}-required`) !== group.required ||
          !sameNumber(`${group.id}-min`, group.minSelect) || !sameNumber(`${group.id}-max`, group.maxSelect)) ||
        variants.some(variant => text(data, `size-${variant.id}-name`) !== variant.name.trim() || !sameNumber(`${variant.id}-price`, variant.price) ||
          data.has(`${variant.id}-available`) !== (variant.available === true) || groups.some(group => {
            const limit = variant.groupLimits.find(entry => entry.groupId === group.id) ?? group;
            return !sameNumber(`${variant.id}-${group.id}-min`, limit.minSelect) || !sameNumber(`${variant.id}-${group.id}-max`, limit.maxSelect);
          }));
    } catch { /* Invalid in-progress input is still unsaved. */ }
    if (changed) markDirty("configuration"); else markClean("configuration");
  }

  function trackStructure(action: "addGroup" | "addVariant", form: HTMLFormElement) {
    const data = new FormData(form);
    const changed = text(data, "name") !== "" || (action === "addVariant" ? text(data, "price") !== ""
      : data.has("required") || text(data, "new-group-min") !== "0" || text(data, "new-group-max") !== "1");
    if (changed) markDirty(action); else markClean(action);
  }

  async function refresh() {
    const updated = await requestProduct<Configuration>(configurationUrl, "Não foi possível recarregar a configuração.");
    onRefresh(updated);
    setValidation(undefined);
    afterRefresh.current?.();
    afterRefresh.current = undefined;
    setNeedsRefresh(false);
  }

  async function run(write?: () => Promise<unknown>, afterSave?: () => void, savedKey?: string, target?: ReviewTarget) {
    if (lock.current || (write && needsRefresh)) return;
    const related = target ?? (write ? formReviewTarget(savedKey, configuration) : { section: "publication" as const });
    lock.current = true;
    setOperation({ productId: product.id, kind: write ? "save" : "refresh", target: related });
    onBusy(true);
    setBusy(true);
    setNotice(undefined);
    try {
      if (write) {
        setValidation(undefined);
        await write();
        setLastSave({ productId: product.id, target: related });
        if (savedKey) markClean(savedKey);
        afterRefresh.current = afterSave;
        setNeedsRefresh(true);
      }
      try {
        await refresh();
        setNotice({ message: write ? "Esta operação foi salva. Outros formulários podem ter alterações pendentes." : "Dados recarregados do servidor.", error: false, target: related });
      } catch (error) {
        setNeedsRefresh(true);
        setNotice({
          message: write ? "Esta operação foi salva, mas não foi possível recarregar os dados. Recarregue para continuar." : safeProductMessage(error instanceof Error ? error.message : undefined, "Não foi possível recarregar a configuração."),
          error: true, target: related,
        });
      }
    } catch (error) {
      showError(error, "Não foi possível salvar a alteração.", related);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      setOperation(undefined);
    }
  }

  function saveJson(url: string, method: "PATCH" | "POST", body: () => object, afterSave?: () => void, savedKey?: string, target?: ReviewTarget) {
    void run(() => requestProduct(url, "Não foi possível salvar a alteração.", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body()),
    }), afterSave, savedKey, target);
  }

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    saveJson(configurationUrl, "PATCH", () => {
      const configuredGroups = groups.map(group => {
        try {
          return { id: group.id, name: text(data, `group-${group.id}-name`), required: data.has(`${group.id}-required`), ...bounds(data, group.id) };
        } catch (error) { throw new ReviewInputError(error, { section: "customizations", groupId: group.id }); }
      });
      const configuredVariants = variants.map(variant => {
        try {
          return {
            id: variant.id, name: text(data, `size-${variant.id}-name`), price: price(data, `${variant.id}-price`),
            available: data.has(`${variant.id}-available`),
            groupLimits: groups.map(group => {
              try { return { groupId: group.id, ...bounds(data, `${variant.id}-${group.id}`) }; }
              catch (error) { throw new ReviewInputError(error, { section: "sizes", groupId: group.id }); }
            }),
          };
        } catch (error) {
          if (error instanceof ReviewInputError) throw error;
          throw new ReviewInputError(error, { section: "sizes" });
        }
      });
      if (!configuredVariants.some((variant) => variant.available)) {
        throw new Error("Mantenha pelo menos um tamanho ativo.");
      }
      return {
        name: text(data, "name"),
        description: text(data, "description") || null,
        category: categoryValue(String(data.get("category") ?? "")),
        available: data.has("available"),
        groups: configuredGroups,
        variants: configuredVariants,
      };
    }, () => {
      markClean("configuration");
      setSavedRevision((value) => value + 1);
    }, "configuration");
  }

  function addStructure(event: FormEvent<HTMLFormElement>, action: "addGroup" | "addVariant") {
    event.preventDefault();
    if (lock.current || needsRefresh || [...dirty.current].some(key => key !== action)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    saveJson(`/api/product/${encodeURIComponent(product.id)}/structure`, "POST", () => ({
      action, name: text(data, "name"),
      ...(action === "addVariant" ? { price: price(data, "price") }
        : { required: data.has("required"), ...bounds(data, "new-group") }),
    }), () => {
      form.reset();
      markClean(action);
      setSavedRevision(value => value + 1);
    }, action);
  }

  function removeStructure(action: "removeGroup" | "removeVariant", id: string, name: string) {
    if (lock.current || needsRefresh || dirty.current.size) return;
    if (!window.confirm(`Remover "${name}"${action === "removeGroup" ? " e suas opções" : ""}? Itens usados em pedidos não serão removidos.`)) return;
    saveJson(`/api/product/${encodeURIComponent(product.id)}/structure`, "POST", () => ({ action, id }), () => {
      setSavedRevision(value => value + 1);
    }, undefined, { section: action === "removeGroup" ? "customizations" : "sizes", groupId: action === "removeGroup" ? id : undefined });
  }

  function saveImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("product_id", product.id);
    data.set("imageOnly", "true");
    void run(() => {
      const file = data.get("file");
      if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
        throw new Error("Selecione uma imagem de até 5 MiB.");
      }
      return requestProduct("/api/product", "Não foi possível salvar a imagem.", { method: "PUT", body: data });
    }, () => { form.reset(); markClean("image"); }, "image");
  }

  async function validateProduct() {
    if (lock.current || needsRefresh || dirty.current.size) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setPublicationAction("validating");
    setValidation(undefined);
    setNotice(undefined);
    try {
      const result = await requestProduct<PublicationValidation>(
        `/api/product/${encodeURIComponent(product.id)}/validate-publication`,
        "Não foi possível validar o produto. Tente novamente.",
      );
      setValidation(result);
      if (!result.valid) result.errors.forEach(message => revealGroup(issueReviewTarget(message, configuration)));
    } catch (error) {
      showError(error, "Não foi possível validar a configuração. Tente novamente.", { section: "publication", label: "Validação e publicação" });
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      setPublicationAction(undefined);
    }
  }

  async function publishProduct() {
    if (lock.current || needsRefresh || dirty.current.size || !validation?.valid || product.published) return;
    if (!window.confirm(`Publicar "${product.name}"? O produto ficará acessível no cardápio quando estiver disponível.`)) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setPublicationAction("publishing");
    setNotice(undefined);
    try {
      const result = await requestProduct<{ product: { id: string; name: string; published: boolean; available: boolean | null } }>(
        `/api/product/${encodeURIComponent(product.id)}/publish`,
        "Não foi possível confirmar a publicação. Recarregue o status antes de tentar novamente.",
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      onRefresh({ ...configuration, product: { ...product, ...result.product } });
      try {
        await refresh();
        setNotice({
          message: product.available === true ? "Produto publicado." : "Produto publicado e mantido indisponível no cardápio.",
          error: false,
        });
      } catch {
        setNeedsRefresh(true);
        setNotice({ message: "Publicação confirmada. Recarregue a configuração para continuar.", error: true, target: { section: "publication" } });
      }
    } catch (error) {
      setValidation(undefined);
      if (error instanceof ProductRequestError && error.status === 422) {
        const errors = error.details.length ? error.details : [error.message];
        setValidation({ valid: false, errors });
        errors.forEach(message => revealGroup(issueReviewTarget(message, configuration)));
      } else {
        // A lost response can follow a successful commit. Read status before another write.
        setNeedsRefresh(true);
      }
      showError(error, "Não foi possível confirmar a publicação. Recarregue o estado antes de tentar novamente.", { section: "publication", label: "Validação e publicação" });
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      setPublicationAction(undefined);
    }
  }

  const hasPending = dirtyForms.size > 0 || modelPending;
  const confirmedSave = lastSave?.productId === product.id ? lastSave : undefined;
  const currentOperation = operation?.productId === product.id ? operation : undefined;
  const issues = validation?.valid === false ? validation.errors.map(message => ({
    message: safeProductMessage(message, "Revise a configuração e valide novamente."),
    target: issueReviewTarget(message, configuration),
  })) : [];
  const sectionName = (target: ReviewTarget) => target.label ?? editorSections.find(([key]) => key === target.section)?.[1] ?? "Configuração";
  const pendingSection = (key: EditorSection) =>
    (dirtyForms.has("configuration") && ["information", "sizes", "customizations"].includes(key)) ||
    (key === "sizes" && dirtyForms.has("addVariant")) ||
    (key === "customizations" && [...dirtyForms].some(form => form === "addGroup" || form.startsWith("option-") || form.startsWith("new-option-"))) ||
    (key === "publication" && dirtyForms.has("image")) || (key === "management" && modelPending);
  const summary = {
    information: `${product.name} · ${product.category || "Sem categoria (opcional)"} · ${product.description ? "Descrição cadastrada" : "Sem descrição (opcional)"}`,
    sizes: `${variants.length} ${variants.length === 1 ? "tamanho cadastrado" : "tamanhos cadastrados"} · ${variants.filter(variant => variant.available === true).length} ativos · Preço base ${money.format(Number(product.price))}`,
    customizations: `${groups.length} grupos · ${groups.reduce((total, group) => total + group.options.length, 0)} opções cadastradas`,
    publication: `${product.image_url ? "Imagem cadastrada" : "Sem imagem (opcional)"} · ${product.published ? "Publicado" : "Não publicado"}`,
    management: "Modelos privados, disponibilidade e exclusão",
  };
  const progress = publicationAction === "validating" ? "Validando configuração…" : publicationAction === "publishing" ? "Publicando produto…"
    : currentOperation?.kind === "save" ? "Salvamento em andamento…" : currentOperation?.kind === "refresh" ? "Recarregando dados…"
    : currentOperation?.kind === "delete" ? "Exclusão em andamento…" : "Processando modelo…";

  return (
    <div ref={editorRoot} className="space-y-6" onInvalidCapture={event => {
      const section = (event.target as HTMLElement).closest<HTMLElement>("[data-editor-section]")?.dataset.editorSection;
      if (editorSections.some(([key]) => key === section)) {
        activateSection(section as EditorSection);
        const groupId = (event.target as HTMLElement).closest<HTMLElement>("[data-review-group]")?.dataset.reviewGroup;
        const target = { section: section as EditorSection, groupId, label: (event.target as HTMLInputElement).type === "file" ? "Imagem do produto" : undefined };
        revealGroup(target);
        setNotice({ message: "Confira o campo indicado e os valores desta seção.", error: true, target });
      }
    }}>
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-slate-500">{needsRefresh ? "Último estado confirmado: " : ""}{product.published ? "Publicado" : "Não publicado · Rascunho"}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{product.name}</h2>
        <p className="mt-1 text-sm text-slate-600">Preço base atual {money.format(Number(product.price))}</p>
      </header>
      <nav aria-label="Seções do produto" className="flex max-w-full gap-2 overflow-x-auto pb-2">
        {editorSections.map(([key, name]) => <button key={key} type="button"
          aria-pressed={activeSection === key} aria-controls={`product-${product.id}-section-${key}`}
          onClick={() => navigateSection(key)}
          className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${activeSection === key
            ? "border-orange-500 bg-orange-50 text-orange-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          {name}
        </button>)}
      </nav>
      <p className="text-sm text-slate-600">Use os atalhos para ir direto à seção. Os campos permanecem abertos e cada salvamento mantém seu próprio botão.</p>
      <div role="status" aria-live="polite" className="space-y-1 text-sm text-slate-600">
        {busy && <p>{progress}</p>}
        {hasPending && <p className="text-orange-800">Alterações não salvas. Cada formulário deve ser salvo separadamente.</p>}
        {!busy && !hasPending && !needsRefresh && <p>{confirmedSave ? "Dados salvos. Salvar não publica o produto." : "Dados carregados do servidor. Sem alterações não salvas."}</p>}
        {confirmedSave && hasPending && <p>Uma operação de gravação foi confirmada; ainda há alterações não salvas em outros formulários.</p>}
        {needsRefresh && <p>Recarregue os dados para confirmar o estado atual antes de continuar.</p>}
        {!validation && <p>Sem validação atual. Use Validar produto após salvar as alterações.</p>}
        {validation?.valid === false && <p className="text-red-700">Configuração precisa de revisão.</p>}
        {validation?.valid === true && <p className="text-green-700">Configuração validada. A publicação continua sendo uma ação separada.</p>}
        <p>{product.available === true ? "Disponível" : product.available === false ? "Indisponível" : "Disponibilidade não informada"}</p>
      </div>
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-sm text-red-700" : "text-sm text-green-700"}>{safeProductMessage(notice.message)}</p>}
      {notice?.error && notice.target && <button type="button" className={button} onClick={() => visitIssue(notice.target!)}>Revisar {sectionName(notice.target)}</button>}
      {needsRefresh && <button type="button" className={button} disabled={busy} onClick={() => void run()}>Recarregar configuração</button>}

      <section aria-label="Revisão do produto" className="space-y-4 rounded-xl border border-slate-200 p-4">
        <h3 className={title}>Revisão do produto</h3>
        <p className="text-sm text-slate-600">Resumo da última leitura confirmada do servidor. O preenchimento não salvo permanece nos formulários. Informações, tamanhos e regras compartilham um salvamento.</p>
        <ul className="space-y-3">
          {editorSections.map(([key, name]) => <li key={key} className="space-y-1 border-b border-slate-100 pb-3">
            <p className="font-medium text-slate-800">{name}</p>
            <p className="break-words text-sm text-slate-600">{summary[key]}</p>
            <p className="text-sm text-slate-600">{pendingSection(key) ? "Alterações pendentes neste salvamento" : needsRefresh ? "Recarregar dados" : "Sem alterações pendentes neste salvamento"}</p>
            {issues.some(issue => issue.target.section === key) && <p className="text-sm text-red-700">A validação apontou itens para revisar.</p>}
            {notice?.error && notice.target?.section === key && <p className="text-sm text-red-700">A última operação nesta área precisa de atenção.</p>}
            <button type="button" className={button} onClick={() => navigateSection(key)}>Ir para {name}</button>
          </li>)}
        </ul>
      </section>

      <form id={configurationFormId} onChangeCapture={trackConfiguration} onSubmit={saveConfiguration}>
        <fieldset key={savedRevision} disabled={disabled} className="space-y-6">
          <section id={`product-${product.id}-section-information`} data-editor-section="information" tabIndex={-1}
            onFocusCapture={() => activateSection("information")} className={section}>
            <h3 className={title}>Informações do produto</h3>
            <label className={label}>Nome<input className={input} name="name" defaultValue={product.name} required /></label>
            <CategoryField className={input} suggestions={categories} defaultValue={product.category ?? ""} />
            <label className={label}>Descrição<textarea className={input} name="description" defaultValue={product.description ?? ""} rows={3} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" defaultChecked={product.available === true} /> Produto disponível</label>
          </section>

          <section id={`product-${product.id}-section-sizes`} data-editor-section="sizes" tabIndex={-1}
            onFocusCapture={() => activateSection("sizes")} className={section}>
            <h3 className={title}>Tamanhos e preços</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {variants.map((variant) => {
                const limits = new Map(variant.groupLimits.map((limit) => [limit.groupId, limit]));
                return (
                  <section key={variant.id} aria-label={variant.name} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <label className={label}>Nome do tamanho<input className={input} name={`size-${variant.id}-name`} defaultValue={variant.name} required /></label>
                    <label className={label}>Preço (R$)<input className={input} name={`${variant.id}-price`} inputMode="decimal" defaultValue={variant.price} required /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`${variant.id}-available`} defaultChecked={variant.available === true} /> Tamanho ativo</label>
                    <button type="button" className={button} disabled={disabled || dirtyForms.size > 0 || variants.length <= 1}
                      onClick={() => removeStructure("removeVariant", variant.id, variant.name)}>Remover tamanho</button>
                    {groups.map((group) => {
                      const limit = limits.get(group.id) ?? group;
                      return (
                        <fieldset key={group.id} className="border-t border-slate-100 pt-2">
                          <legend className="text-sm font-medium text-slate-700">{group.name}</legend>
                          <BoundFields prefix={`${variant.id}-${group.id}`} min={limit.minSelect} max={limit.maxSelect} />
                        </fieldset>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </section>
        </fieldset>
      </form>

      <section id={`product-${product.id}-section-customizations`} data-editor-section="customizations" tabIndex={-1}
        onFocusCapture={() => activateSection("customizations")} className={section} aria-label="Personalizações">
        <h3 className={title}>Personalizações</h3>
        <p className="text-sm text-slate-600">Edite as regras do grupo e cadastre suas opções abaixo. Cada opção é salva separadamente.</p>
        {groups.length === 0 && <p className="text-sm text-slate-600">Nenhum grupo cadastrado. Use Adicionar grupo para oferecer escolhas e adicionais.</p>}
        {groups.map(group => {
          const collapsed = collapsedGroups.has(group.id);
          const contentId = `product-${product.id}-group-${group.id}`;
          const customizedSizes = variants.filter(variant => variant.groupLimits.some(limit =>
            limit.groupId === group.id && (limit.minSelect !== group.minSelect || limit.maxSelect !== group.maxSelect),
          ));
          const choiceSummary = group.minSelect === group.maxSelect
            ? `Escolha ${group.maxSelect} ${group.maxSelect === 1 ? "opção" : "opções"}.`
            : group.minSelect === 0
              ? `Escolha até ${group.maxSelect} ${group.maxSelect === 1 ? "opção" : "opções"}.`
              : `Escolha de ${group.minSelect} a ${group.maxSelect} opções.`;
          return <section key={group.id} data-review-group={group.id} tabIndex={-1} aria-label={`Grupo ${group.name}`} className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h4 className="break-words font-medium text-slate-800">{group.name}</h4>
                <p className="text-sm text-slate-600">{group.required ? "Obrigatório" : "Opcional"} · Limites gerais: {choiceSummary}</p>
                <p className="text-sm text-slate-600">{`${group.options.length} ${group.options.length === 1 ? "opção cadastrada" : "opções cadastradas"} · ${group.options.filter(option => option.available === true).length} disponíveis`}</p>
                {customizedSizes.length > 0 && <p className="text-sm font-medium text-orange-700">Regras específicas por tamanho: {customizedSizes.map(variant => variant.name).join(", ")}. Consulte Tamanhos e preços.</p>}
              </div>
              <button type="button" className={button} aria-expanded={!collapsed} aria-controls={contentId}
                onClick={() => setCollapsedGroups(current => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                  return next;
                })}>{collapsed ? "Expandir grupo" : "Recolher grupo"}</button>
            </div>
            <div id={contentId} data-group-content hidden={collapsed} className="space-y-4" onInvalidCapture={event => {
              // External required controls still participate in native form validation.
              event.currentTarget.hidden = false;
              setCollapsedGroups(current => { const next = new Set(current); next.delete(group.id); return next; });
            }}>
              <fieldset key={savedRevision} disabled={disabled} onChangeCapture={trackConfiguration} className="space-y-3">
                <legend className="text-sm font-semibold text-slate-700">Editar regras do grupo</legend>
                <label className={label}>Nome do grupo<input className={input} form={configurationFormId} name={`group-${group.id}-name`} defaultValue={group.name} required /></label>
                <label className="flex items-center gap-2 text-sm"><input form={configurationFormId} type="checkbox" name={`${group.id}-required`} defaultChecked={group.required} /> Obrigatório</label>
                <BoundFields form={configurationFormId} prefix={group.id} min={group.minSelect} max={group.maxSelect} />
                <p className="text-sm text-slate-600">Salve estas regras em Salvar informações e configuração.</p>
                <button type="button" className={button} disabled={disabled || dirtyForms.size > 0}
                  onClick={() => removeStructure("removeGroup", group.id, group.name)}>Remover grupo</button>
              </fieldset>
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-slate-700">Opções e adicionais</h5>
                {group.options.length === 0 && <p className="text-sm text-slate-600">Nenhuma opção cadastrada neste grupo.</p>}
                {group.options.map(option => (
                  <OptionForm key={`${option.id}:${option.name}:${option.additionalPrice}:${option.available}`} groupId={group.id} option={option} disabled={disabled}
                    onDirty={changed => changed ? markDirty(`option-${option.id}`) : markClean(`option-${option.id}`)}
                    onSave={(url, method, body, afterSave) => saveJson(url, method, body, () => {
                      afterSave?.(); markClean(`option-${option.id}`);
                    }, `option-${option.id}`)} />
                ))}
                <OptionForm key={`new-option-${group.id}`} groupId={group.id} disabled={disabled}
                  onDirty={changed => changed ? markDirty(`new-option-${group.id}`) : markClean(`new-option-${group.id}`)}
                  onSave={(url, method, body, afterSave) => saveJson(url, method, body, () => {
                    afterSave?.(); markClean(`new-option-${group.id}`);
                  }, `new-option-${group.id}`)} />
              </div>
            </div>
          </section>;
        })}
        <p className="text-sm text-slate-600">Este salvamento atualiza informações, disponibilidade, tamanhos, preços e regras dos grupos, inclusive os recolhidos. Imagem e opções são salvas separadamente.</p>
        <button type="submit" form={configurationFormId} className={button} disabled={disabled}>Salvar informações e configuração</button>
      </section>

      <section data-editor-section="customizations" onFocusCapture={() => activateSection("customizations")} className={section}>
        <h3 className={title}>Adicionar tamanhos e grupos</h3>
        <p className="text-sm text-slate-600">Salve as alterações antes de mudar a estrutura. Novos tamanhos recebem os limites gerais dos grupos; ajuste os limites por tamanho na configuração.</p>
        <form aria-label="Adicionar tamanho" data-editor-section="sizes" onFocusCapture={() => activateSection("sizes")} onChangeCapture={event => trackStructure("addVariant", event.currentTarget)} onSubmit={event => addStructure(event, "addVariant")}>
          <fieldset disabled={disabled || [...dirtyForms].some(key => key !== "addVariant")} className="space-y-3">
            <label className={label}>Nome do novo tamanho<input className={input} name="name" required /></label>
            <label className={label}>Preço (R$)<input className={input} name="price" inputMode="decimal" required /></label>
            <button type="submit" className={button}>Adicionar tamanho</button>
          </fieldset>
        </form>
        <form aria-label="Adicionar grupo" onChangeCapture={event => trackStructure("addGroup", event.currentTarget)} onSubmit={event => addStructure(event, "addGroup")}>
          <fieldset disabled={disabled || [...dirtyForms].some(key => key !== "addGroup")} className="space-y-3">
            <label className={label}>Nome do novo grupo<input className={input} name="name" required /></label>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="required" /> Obrigatório</label>
            <BoundFields prefix="new-group" min={0} max={1} />
            <p className="text-sm text-slate-600">Em produto publicado, adicione primeiro um grupo opcional com mínimo zero, cadastre as opções e depois ajuste a obrigatoriedade.</p>
            <button type="submit" className={button}>Adicionar grupo</button>
          </fieldset>
        </form>
      </section>

      <section id={`product-${product.id}-section-publication`} data-editor-section="publication" tabIndex={-1}
        onFocusCapture={() => activateSection("publication")} className={section}>
        <h3 className={title}>Imagem do produto</h3>
        {product.image_url && <Image src={product.image_url} width={160} height={120} alt={product.name} unoptimized className="h-28 w-40 rounded-lg object-cover" />}
        <form onChangeCapture={(event) => {
          const file = new FormData(event.currentTarget).get("file");
          if (file instanceof File && file.size > 0) markDirty("image");
          else markClean("image");
        }} onSubmit={saveImage}>
          <fieldset disabled={disabled} className="flex flex-wrap items-end gap-3">
            <label className={label}>Selecionar imagem (até 5 MiB)
              <input className={input} name="file" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff" required />
            </label>
            <button type="submit" className={button}>Salvar imagem</button>
          </fieldset>
        </form>
      </section>

      <section data-review-validation tabIndex={-1} data-editor-section="publication" onFocusCapture={() => activateSection("publication")} className="space-y-3 border-t border-slate-200 pt-5" aria-label="Validação e publicação">
        <h3 className={title}>Validação e publicação</h3>
        {dirtyForms.size > 0 && <p className="text-sm text-orange-800">Salve as alterações dos formulários antes de validar o produto.</p>}
        <button type="button" className={button} disabled={disabled || dirtyForms.size > 0} onClick={() => void validateProduct()}>
          {publicationAction === "validating" ? "Validando…" : "Validar produto"}
        </button>
        {validation && (
          validation.valid ? <p role="status" className="text-sm text-green-700">Configuração válida.</p> : (
            <div role="alert" className="text-sm text-red-700">
              <p>Revise a configuração do produto.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.map((issue, index) => <li key={index} className="space-y-2">
                  <p>{issue.message}</p>
                  <button type="button" className={button} onClick={() => visitIssue(issue.target)}>Revisar {sectionName(issue.target)}</button>
                </li>)}
              </ul>
            </div>
          )
        )}
        {!product.published && validation?.valid && (
          <button type="button" className={button} disabled={disabled || dirtyForms.size > 0} onClick={() => void publishProduct()}>
            {publicationAction === "publishing" ? "Publicando…" : "Publicar produto"}
          </button>
        )}
      </section>
      <section id={`product-${product.id}-section-management`} data-editor-section="management" tabIndex={-1}
        onFocusCapture={() => activateSection("management")} className={section}>
        <h3 className={title}>Gerenciar produto</h3>
        <SavePrivateTemplate productId={product.id} disabled={disabled || dirtyForms.size > 0}
          onPendingChange={value => { templatePending.current = value; setModelPending(value); onPendingChange?.(dirty.current.size > 0 || value); }}
          onBusy={value => { lock.current = value; setBusy(value); onBusy(value); setOperation(value ? { productId: product.id, kind: "model", target: { section: "management" } } : undefined); }} />
        <p>{product.available === true ? "Disponível" : "Desativado"}. Produtos com pedidos devem ser desativados para preservar o histórico.</p>
        <button type="button" className={button} disabled={disabled || dirtyForms.size > 0 || product.available === false}
          onClick={() => {
            if (lock.current || dirty.current.size) return;
            if (window.confirm(`Desativar "${product.name}" e impedir novos pedidos?`)) {
              saveJson(`/api/product/${encodeURIComponent(product.id)}/deactivate`, "PATCH", () => ({}));
            }
          }}>Desativar produto</button>
        {!product.published && <button type="button" className={button} disabled={disabled || dirtyForms.size > 0 || templatePending.current}
          onClick={() => void deleteDraft()}>Excluir rascunho</button>}
      </section>
    </div>
  );
}
