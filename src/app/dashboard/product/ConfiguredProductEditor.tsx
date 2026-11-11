"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { requestProduct, ProductRequestError, type PublicationValidation, type Configuration } from "./configuredProductClient";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button = "rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50";
const section = "space-y-4 border-b border-slate-200 pb-6";
const title = "font-semibold text-slate-900";
const label = "block space-y-1 text-sm font-medium text-slate-700";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

function BoundFields({ prefix, min, max }: { prefix: string; min: number; max: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className={label}>Mínimo
        <input className={input} name={`${prefix}-min`} type="number" min={0} max={100} step={1} defaultValue={min} required />
      </label>
      <label className={label}>Máximo
        <input className={input} name={`${prefix}-max`} type="number" min={0} max={100} step={1} defaultValue={max} required />
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
        <button className={button} type="submit">{option ? "Salvar opção" : "Adicionar opção"}</button>
      </fieldset>
    </form>
  );
}

export default function ConfiguredProductEditor({ configuration, onRefresh, onBusy }: {
  configuration: Configuration;
  onRefresh: (configuration: Configuration) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { product, variants, groups } = configuration;
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean }>();
  const [savedRevision, setSavedRevision] = useState(0);
  const [validation, setValidation] = useState<PublicationValidation>();
  const [publicationAction, setPublicationAction] = useState<"validating" | "publishing">();
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(new Set());
  const dirty = useRef(new Set<string>());
  const lock = useRef(false);
  const afterRefresh = useRef<(() => void) | undefined>(undefined);
  const configurationUrl = `/api/product/${encodeURIComponent(product.id)}/configuration`;
  const disabled = busy || needsRefresh;
  function markDirty(key: string) {
    dirty.current.add(key);
    setDirtyForms(new Set(dirty.current));
    setValidation(undefined);
  }

  function markClean(key: string) {
    dirty.current.delete(key);
    setDirtyForms(new Set(dirty.current));
  }

  async function refresh() {
    const updated = await requestProduct<Configuration>(configurationUrl, "Não foi possível recarregar a configuração.");
    onRefresh(updated);
    setValidation(undefined);
    afterRefresh.current?.();
    afterRefresh.current = undefined;
    setNeedsRefresh(false);
  }

  async function run(write?: () => Promise<unknown>, afterSave?: () => void) {
    if (lock.current || (write && needsRefresh)) return;
    lock.current = true;
    onBusy(true);
    setBusy(true);
    setNotice(undefined);
    try {
      if (write) {
        setValidation(undefined);
        await write();
        afterRefresh.current = afterSave;
        setNeedsRefresh(true);
      }
      try {
        await refresh();
        setNotice({ message: write ? "Alterações salvas." : "Configuração atualizada.", error: false });
      } catch (error) {
        setNeedsRefresh(true);
        setNotice({
          message: write ? "Alterações salvas. Recarregue a configuração para continuar." : error instanceof Error ? error.message : "Não foi possível recarregar a configuração.",
          error: true,
        });
      }
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Não foi possível salvar a alteração.", error: true });
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  function saveJson(url: string, method: "PATCH" | "POST", body: () => object, afterSave?: () => void) {
    void run(() => requestProduct(url, "Não foi possível salvar a alteração.", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body()),
    }), afterSave);
  }

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    saveJson(configurationUrl, "PATCH", () => {
      const configuredGroups = groups.map((group) => ({
        id: group.id, name: text(data, `group-${group.id}-name`), required: data.has(`${group.id}-required`),
        ...bounds(data, group.id),
      }));
      const configuredVariants = variants.map((variant) => ({
        id: variant.id,
        name: text(data, `size-${variant.id}-name`),
        price: price(data, `${variant.id}-price`),
        available: data.has(`${variant.id}-available`),
        groupLimits: groups.map((group) => ({
          groupId: group.id, ...bounds(data, `${variant.id}-${group.id}`),
        })),
      }));
      if (!configuredVariants.some((variant) => variant.available)) {
        throw new Error("Mantenha pelo menos um tamanho ativo.");
      }
      return {
        name: text(data, "name"),
        description: text(data, "description") || null,
        available: data.has("available"),
        groups: configuredGroups,
        variants: configuredVariants,
      };
    }, () => {
      markClean("configuration");
      setSavedRevision((value) => value + 1);
    });
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
    }, () => { form.reset(); markClean("image"); });
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
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Falha ao validar o produto.", error: true });
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
        setNotice({ message: "Publicação confirmada. Recarregue a configuração para continuar.", error: true });
      }
    } catch (error) {
      setValidation(undefined);
      if (error instanceof ProductRequestError && error.status === 422) {
        setValidation({ valid: false, errors: error.details.length ? error.details : [error.message] });
      } else {
        // A lost response can follow a successful commit. Read status before another write.
        setNeedsRefresh(true);
      }
      setNotice({ message: error instanceof Error ? error.message : "Falha ao publicar o produto.", error: true });
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      setPublicationAction(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-slate-500">{product.published ? "Publicado" : "Rascunho"}</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">{product.name}</h2>
        <p className="mt-1 text-sm text-slate-600">Preço base atual {money.format(Number(product.price))}</p>
      </header>
      {busy && <p role="status" className="text-sm text-slate-600">Processando alterações…</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-sm text-red-700" : "text-sm text-green-700"}>{notice.message}</p>}
      {needsRefresh && <button type="button" className={button} disabled={busy} onClick={() => void run()}>Recarregar configuração</button>}

      <form onChangeCapture={() => markDirty("configuration")} onSubmit={saveConfiguration}>
        <fieldset key={savedRevision} disabled={disabled} className="space-y-6">
          <section className={section}>
            <h3 className={title}>Dados do produto</h3>
            <label className={label}>Nome<input className={input} name="name" defaultValue={product.name} required /></label>
            <label className={label}>Descrição<textarea className={input} name="description" defaultValue={product.description ?? ""} rows={3} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" defaultChecked={product.available === true} /> Produto disponível</label>
          </section>

          <section className={section}>
            <h3 className={title}>Grupos de escolhas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <label className={label}>Nome do grupo<input className={input} name={`group-${group.id}-name`} defaultValue={group.name} required /></label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`${group.id}-required`} defaultChecked={group.required} /> Obrigatório</label>
                  <BoundFields prefix={group.id} min={group.minSelect} max={group.maxSelect} />
                </div>
              ))}
            </div>
          </section>

          <section className={section}>
            <h3 className={title}>Tamanhos e preços</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {variants.map((variant) => {
                const limits = new Map(variant.groupLimits.map((limit) => [limit.groupId, limit]));
                return (
                  <section key={variant.id} aria-label={variant.name} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <label className={label}>Nome do tamanho<input className={input} name={`size-${variant.id}-name`} defaultValue={variant.name} required /></label>
                    <label className={label}>Preço (R$)<input className={input} name={`${variant.id}-price`} inputMode="decimal" defaultValue={variant.price} required /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`${variant.id}-available`} defaultChecked={variant.available === true} /> Tamanho ativo</label>
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
          <button type="submit" className={button}>Salvar configuração</button>
        </fieldset>
      </form>

      <section className={section}>
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

      <section className="space-y-4">
        <h3 className={title}>Ingredientes e adicionais</h3>
        {groups.map((group) => (
          <section key={group.id} className="space-y-3">
            <h4 className="font-medium text-slate-800">{group.name}</h4>
            {group.options.map((option) => (
              <OptionForm key={`${option.id}:${option.name}:${option.additionalPrice}:${option.available}`} groupId={group.id} option={option} disabled={disabled}
                onDirty={(changed) => changed ? markDirty(`option-${option.id}`) : markClean(`option-${option.id}`)}
                onSave={(url, method, body, afterSave) => saveJson(url, method, body, () => {
                  afterSave?.();
                  markClean(`option-${option.id}`);
                })} />
            ))}
            <OptionForm groupId={group.id} disabled={disabled} onDirty={(changed) => changed ? markDirty(`new-option-${group.id}`) : markClean(`new-option-${group.id}`)}
              onSave={(url, method, body, afterSave) => saveJson(url, method, body, () => {
                afterSave?.();
                markClean(`new-option-${group.id}`);
              })} />
          </section>
        ))}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5" aria-label="Validação e publicação">
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
                {validation.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
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
    </div>
  );
}
