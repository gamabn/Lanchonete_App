"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import CategoryField, { useProductCategories } from "./CategoryField";
import { categoryValue } from "./productCategory";
import ConfiguredProductEditor from "./ConfiguredProductEditor";
import { requestProduct, type Configuration } from "./configuredProductClient";
import {
  PrivateTemplateManager,
  type PrivateTemplate,
} from "./PrivateTemplateControls";

interface Template {
  slug: string;
  name: string;
  version: number;
}

interface Draft {
  id: string;
  name: string;
  published: boolean;
}

type LoadResult<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const panelClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100";
const buttonClass =
  "rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50";
const linkClass =
  "text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50";

export default function ConfiguredProductForm({
  draftId,
  onDraftChange,
  onProductLoaded,
  onPendingChange,
  view = "scratch",
}: {
  view?: "scratch" | "templates" | "models";
  draftId: string;
  onProductLoaded?: (product: { id: string; name: string }) => void;
  onDraftChange: (id: string, beforeChange?: () => void) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const categories = useProductCategories();
  const [templateCategory, setTemplateCategory] = useState("");
  const [templates, setTemplates] = useState<LoadResult<Template[]>>({
    status: "loading",
  });
  const [drafts, setDrafts] = useState<LoadResult<Draft[]>>({
    status: "loading",
  });
  const [configuration, setConfiguration] = useState<LoadResult<Configuration>>(
    { status: "loading" },
  );
  const [revision, setRevision] = useState(0);
  const [templateSlug, setTemplateSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createError, setCreateError] = useState("");
  const pending = useRef(new Map<string, boolean>());
  function reportPending(key: string, value: boolean) {
    pending.current.set(key, value);
    onPendingChange?.([...pending.current.values()].some(Boolean));
  }
  useEffect(() => {
    reportPending("editor", false);
  }, [draftId]);
  const creatingRef = useRef(false);
  const [privateTemplates, setPrivateTemplates] = useState<
    LoadResult<PrivateTemplate[]>
  >({ status: "loading" });
  const [managingTemplates, setManagingTemplates] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const init = { signal: controller.signal };

    async function load<T>(
      url: string,
      fallback: string,
      update: (state: LoadResult<T>) => void,
    ) {
      try {
        const data = await requestProduct<T>(url, fallback, init);
        if (!controller.signal.aborted) update({ status: "ready", data });
      } catch (error) {
        if (!controller.signal.aborted) {
          update({
            status: "error",
            message: error instanceof Error ? error.message : fallback,
          });
        }
      }
    }

    if (draftId) {
      void load<Configuration>(
        `/api/product/${encodeURIComponent(draftId)}/configuration`,
        "Não foi possível carregar o produto.",
        setConfiguration,
      );
    } else {
      void load<Template[]>(
        "/api/product/templates",
        "Não foi possível carregar os modelos.",
        setTemplates,
      );
      void load<Draft[]>(
        "/api/product?configured=true",
        "Não foi possível carregar os produtos configuráveis.",
        setDrafts,
      );
    }

    void load<PrivateTemplate[]>(
      "/api/product/templates/private",
      "Não foi possível carregar os modelos privados.",
      setPrivateTemplates,
    );
    return () => controller.abort();
  }, [draftId, revision]);

  useEffect(() => {
    if (
      draftId &&
      configuration.status === "ready" &&
      configuration.data.product.id === draftId
    ) {
      onProductLoaded?.({ id: draftId, name: configuration.data.product.name });
    }
  }, [draftId, configuration, onProductLoaded]);

  function refreshLists() {
    setTemplates({ status: "loading" });
    setDrafts({ status: "loading" });
    setPrivateTemplates({ status: "loading" });
    setRevision((value) => value + 1);
  }

  async function createDraft() {
    if (
      creatingRef.current ||
      managingTemplates ||
      draftId ||
      !templateSlug ||
      drafts.status !== "ready"
    )
      return;

    creatingRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const own = templateSlug.startsWith("private:");
      const selected =
        privateTemplates.status === "ready"
          ? privateTemplates.data.find(
              (item) => `private:${item.id}` === templateSlug,
            )
          : undefined;
      if (own && (!selected?.version || !selected.active))
        throw new Error("Selecione um modelo privado disponível.");
      const result = await requestProduct<{ product: { id: string } }>(
        own
          ? "/api/product/from-private-template"
          : "/api/product/from-template",
        "Não foi possível confirmar a criação.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            own
              ? { templateId: selected!.id, expectedVersion: selected!.version }
              : {
                  templateSlug: templateSlug.replace(/^global:/, ""),
                  category: categoryValue(templateCategory),
                },
          ),
        },
      );
      if (!result.product?.id) {
        throw new Error("O servidor não retornou o ID do rascunho.");
      }
      reportPending("template", false);
      setTemplateSlug("");
      setTemplateCategory("");
      openDraft(result.product.id);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a criação.",
      );
      refreshLists();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function openDraft(id: string) {
    onDraftChange(id, () => {
      reportPending("editor", false);
      setConfiguration({ status: "loading" });
    });
  }

  async function createFromScratch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      creatingRef.current ||
      managingTemplates ||
      draftId ||
      drafts.status !== "ready"
    )
      return;
    const data = new FormData(event.currentTarget);
    creatingRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const result = await requestProduct<{ product: { id: string } }>(
        "/api/product/configured",
        "Não foi possível confirmar a criação.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: categoryValue(String(data.get("category") ?? "")),
            name: String(data.get("name") ?? ""),
            description: String(data.get("description") ?? ""),
            variantName: String(data.get("variantName") ?? ""),
            price: String(data.get("price") ?? ""),
          }),
        },
      );
      if (!result.product?.id)
        throw new Error("O servidor não retornou o ID do rascunho.");
      reportPending("scratch", false);
      openDraft(result.product.id);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o produto.",
      );
      refreshLists();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  const editor = draftId ? (
    <section hidden={view === "models"} className={panelClass}>
      <button
        type="button"
        className={`mb-5 ${linkClass}`}
        disabled={editing}
        onClick={() => {
          onDraftChange("", () => {
            setCreateError("");
            reportPending("editor", false);
            refreshLists();
          });
        }}
      >
        Voltar aos produtos
      </button>
      {configuration.status === "loading" && (
        <p role="status">Carregando produto…</p>
      )}
      {configuration.status === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-700">
            {configuration.message}
          </p>
          <button
            type="button"
            className={linkClass}
            onClick={() => {
              setConfiguration({ status: "loading" });
              setRevision((value) => value + 1);
            }}
          >
            Tentar carregar novamente
          </button>
        </div>
      )}
      {configuration.status === "ready" && (
        <ConfiguredProductEditor
          key={draftId}
          configuration={configuration.data}
          categories={categories}
          onPendingChange={(value) => reportPending("editor", value)}
          onRefresh={(data) => {
            setConfiguration({ status: "ready", data });
            setDrafts((current) =>
              current.status === "ready"
                ? {
                    status: "ready",
                    data: current.data.map((item) =>
                      item.id === data.product.id
                        ? {
                            ...item,
                            name: data.product.name,
                            published: data.product.published,
                          }
                        : item,
                    ),
                  }
                : current,
            );
          }}
          onBusy={setEditing}
          onDeleted={() => {
            setEditing(false);
            refreshLists();
            onDraftChange("");
          }}
        />
      )}
    </section>
  ) : null;

  return (
    <>
      {editor}
      <div className="space-y-6 text-gray-800">
        <section
          hidden={Boolean(draftId) || view !== "scratch"}
          className={panelClass}
        >
          <h2 className="font-semibold text-slate-900">Novo produto do zero</h2>
          <p className="mt-2 text-sm text-slate-600">
            Comece com um tamanho. Depois adicione tamanhos, grupos e opções no
            editor. O produto será salvo como rascunho.
          </p>
          <form
            aria-label="Criar produto do zero"
            onChangeCapture={(event) => {
              const data = new FormData(event.currentTarget);
              reportPending(
                "scratch",
                [
                  "name",
                  "description",
                  "category",
                  "variantName",
                  "price",
                ].some((key) => String(data.get(key) ?? "").trim() !== ""),
              );
            }}
            onSubmit={createFromScratch}
            className="mt-4 space-y-3"
          >
            <fieldset
              disabled={
                creating || managingTemplates || drafts.status !== "ready"
              }
              className="space-y-3"
            >
              <label className="block text-sm">
                Nome do produto
                <input className={selectClass} name="name" required />
              </label>
              <CategoryField className={selectClass} suggestions={categories} />
              <label className="block text-sm">
                Descrição
                <textarea className={selectClass} name="description" />
              </label>
              <label className="block text-sm">
                Nome do primeiro tamanho
                <input
                  className={selectClass}
                  name="variantName"
                  placeholder="Ex.: Pequena, Duplo ou 300 ml"
                  required
                />
              </label>
              <label className="block text-sm">
                Preço (R$)
                <input
                  className={selectClass}
                  name="price"
                  inputMode="decimal"
                  required
                />
              </label>
              <button className={buttonClass} type="submit">
                {creating ? "Criando rascunho…" : "Criar do zero"}
              </button>
            </fieldset>
          </form>
          {createError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {createError} Confira os produtos antes de tentar novamente.
            </p>
          )}
        </section>
        <section
          hidden={Boolean(draftId) || view !== "templates"}
          className={panelClass}
        >
          <h2 className="font-semibold text-slate-900">Usar modelo pronto</h2>
          <p className="mt-2 text-sm text-slate-600">
            Crie um novo produto a partir de uma cópia. O modelo original
            permanece independente.
          </p>
          {templates.status === "loading" && (
            <p role="status" className="mt-3 text-sm text-slate-500">
              Carregando modelos…
            </p>
          )}
          {templates.status === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {templates.message}
            </p>
          )}
          {privateTemplates.status === "error" && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {privateTemplates.message} Os modelos globais continuam
              disponíveis quando carregados.
            </p>
          )}
          {(templates.status === "ready" ||
            privateTemplates.status === "ready") &&
            ((templates.status === "ready" ? templates.data.length : 0) +
              (privateTemplates.status === "ready"
                ? privateTemplates.data.filter(
                    (item) => item.active && item.version,
                  ).length
                : 0) ===
            0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nenhum modelo disponível.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label
                  htmlFor="product-template"
                  className="block text-sm font-medium text-slate-700"
                >
                  Modelo
                </label>
                <select
                  id="product-template"
                  className={selectClass}
                  value={templateSlug}
                  disabled={creating || managingTemplates}
                  onChange={(event) => {
                    setTemplateSlug(event.target.value);
                    reportPending(
                      "template",
                      Boolean(event.target.value || templateCategory),
                    );
                  }}
                >
                  <option value="">Selecione um modelo</option>
                  <optgroup label="Modelos da plataforma">
                    {templates.status === "ready" &&
                      templates.data.map((template) => (
                        <option
                          key={`${template.slug}:${template.version}`}
                          value={`global:${template.slug}`}
                        >
                          {template.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Meus modelos">
                    {privateTemplates.status === "ready" &&
                      privateTemplates.data
                        .filter((item) => item.active && item.version)
                        .map((template) => (
                          <option
                            key={template.id}
                            value={`private:${template.id}`}
                          >
                            {template.name}
                          </option>
                        ))}
                  </optgroup>
                </select>
                {templateSlug.startsWith("global:") && (
                  <CategoryField
                    className={selectClass}
                    suggestions={categories}
                    value={templateCategory}
                    onChange={(event) => {
                      setTemplateCategory(event.target.value);
                      reportPending(
                        "template",
                        Boolean(templateSlug || event.target.value),
                      );
                    }}
                    disabled={creating || managingTemplates}
                  />
                )}
                <button
                  type="button"
                  className={buttonClass}
                  onClick={createDraft}
                  disabled={
                    !templateSlug ||
                    creating ||
                    managingTemplates ||
                    drafts.status !== "ready"
                  }
                >
                  {creating ? "Criando rascunho…" : "Criar rascunho"}
                </button>
              </div>
            ))}
          {createError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {createError} Confira os rascunhos antes de tentar novamente.
            </p>
          )}
        </section>
        {!draftId &&
          view !== "models" &&
          (drafts.status === "error" ||
            templates.status === "error" ||
            privateTemplates.status === "error") && (
            <div className="space-y-3">
              {drafts.status === "error" && (
                <p role="alert" className="text-sm text-red-700">
                  {drafts.message}
                </p>
              )}
              <button
                type="button"
                className={linkClass}
                onClick={refreshLists}
              >
                Tentar carregar novamente
              </button>
            </div>
          )}
        <section hidden={view !== "models"} className={panelClass}>
          {privateTemplates.status === "loading" && (
            <p role="status">Carregando meus modelos…</p>
          )}
          {privateTemplates.status === "error" && (
            <p role="alert">{privateTemplates.message}</p>
          )}
          {privateTemplates.status !== "ready" && (
            <button type="button" className={linkClass} onClick={refreshLists}>
              Tentar carregar novamente
            </button>
          )}
          {privateTemplates.status === "ready" && (
            <PrivateTemplateManager
              templates={privateTemplates.data}
              disabled={creating}
              onChanged={refreshLists}
              onBusy={setManagingTemplates}
            />
          )}
        </section>
      </div>
    </>
  );
}
