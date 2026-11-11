"use client";

import { useEffect, useRef, useState } from "react";
import ConfiguredProductEditor from "./ConfiguredProductEditor";
import { requestProduct, type Configuration } from "./configuredProductClient";

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

const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const selectClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100";
const buttonClass = "rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50";
const linkClass = "text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50";

export default function ConfiguredProductForm({ draftId, onDraftChange }: {
  draftId: string;
  onDraftChange: (id: string) => void;
}) {
  const [templates, setTemplates] = useState<LoadResult<Template[]>>({ status: "loading" });
  const [drafts, setDrafts] = useState<LoadResult<Draft[]>>({ status: "loading" });
  const [configuration, setConfiguration] = useState<LoadResult<Configuration>>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [templateSlug, setTemplateSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createError, setCreateError] = useState("");
  const creatingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const init = { signal: controller.signal };

    async function load<T>(url: string, fallback: string, update: (state: LoadResult<T>) => void) {
      try {
        const data = await requestProduct<T>(url, fallback, init);
        if (!controller.signal.aborted) update({ status: "ready", data });
      } catch (error) {
        if (!controller.signal.aborted) {
          update({ status: "error", message: error instanceof Error ? error.message : fallback });
        }
      }
    }

    if (draftId) {
      void load<Configuration>(`/api/product/${encodeURIComponent(draftId)}/configuration`,
        "Não foi possível carregar o rascunho.", setConfiguration);
    } else {
      void load<Template[]>("/api/product/templates", "Não foi possível carregar os modelos.", setTemplates);
      void load<Draft[]>("/api/product?configured=true", "Não foi possível carregar os produtos configuráveis.", setDrafts);
    }

    return () => controller.abort();
  }, [draftId, revision]);

  function refreshLists() {
    setTemplates({ status: "loading" });
    setDrafts({ status: "loading" });
    setRevision((value) => value + 1);
  }

  async function createDraft() {
    if (creatingRef.current || draftId || !templateSlug || drafts.status !== "ready") return;

    creatingRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      const result = await requestProduct<{ product: { id: string } }>("/api/product/from-template",
        "Não foi possível confirmar a criação.", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateSlug }),
        });
      if (!result.product?.id) {
        throw new Error("O servidor não retornou o ID do rascunho.");
      }
      setTemplateSlug("");
      openDraft(result.product.id);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Não foi possível confirmar a criação.");
      refreshLists();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function openDraft(id: string) {
    setConfiguration({ status: "loading" });
    onDraftChange(id);
  }

  if (draftId) {
    return (
      <section className={panelClass}>
        <button type="button" className={`mb-5 ${linkClass}`} disabled={editing} onClick={() => {
          setCreateError("");
          refreshLists();
          onDraftChange("");
        }}>
          Voltar aos produtos configuráveis
        </button>
        {configuration.status === "loading" && <p role="status">Carregando configuração…</p>}
        {configuration.status === "error" && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-700">{configuration.message}</p>
            <button type="button" className={linkClass} onClick={() => {
              setConfiguration({ status: "loading" });
              setRevision((value) => value + 1);
            }}>
              Tentar carregar novamente
            </button>
          </div>
        )}
        {configuration.status === "ready" && <ConfiguredProductEditor
          key={draftId}
          configuration={configuration.data}
          onRefresh={(data) => {
            setConfiguration({ status: "ready", data });
            setDrafts((current) => current.status === "ready" ? {
              status: "ready",
              data: current.data.map((item) => item.id === data.product.id
                ? { ...item, name: data.product.name, published: data.product.published } : item),
            } : current);
          }}
          onBusy={setEditing}
        />}
      </section>
    );
  }

  const products = drafts.status === "ready" ? drafts.data : [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={panelClass}>
        <h2 className="font-semibold text-slate-900">Criar a partir de um modelo</h2>
        {templates.status === "loading" && <p role="status" className="mt-3 text-sm text-slate-500">Carregando modelos…</p>}
        {templates.status === "error" && <p role="alert" className="mt-3 text-sm text-red-700">{templates.message}</p>}
        {templates.status === "ready" && (templates.data.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum modelo disponível.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label htmlFor="product-template" className="block text-sm font-medium text-slate-700">Modelo</label>
            <select id="product-template" className={selectClass} value={templateSlug}
              disabled={creating} onChange={(event) => setTemplateSlug(event.target.value)}>
              <option value="">Selecione um modelo</option>
              {templates.data.map((template) => (
                <option key={`${template.slug}:${template.version}`} value={template.slug}>{template.name}</option>
              ))}
            </select>
            <button type="button" className={buttonClass} onClick={createDraft}
              disabled={!templateSlug || creating || drafts.status !== "ready"}>
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
      <section className={panelClass}>
        <h2 className="font-semibold text-slate-900">Editar produto existente</h2>
        {drafts.status === "loading" && <p role="status" className="mt-3 text-sm text-slate-500">Carregando produtos…</p>}
        {drafts.status === "error" && <p role="alert" className="mt-3 text-sm text-red-700">{drafts.message}</p>}
        {drafts.status === "ready" && (products.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhum produto configurável encontrado.</p>
        ) : (
          <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {products.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-800">
                <span>{product.name} · {product.published ? "Publicado" : "Rascunho"}</span>
                <button type="button" className={linkClass} disabled={creating}
                  aria-label={`Editar ${product.name}`} onClick={() => openDraft(product.id)}>
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        ))}
        {(drafts.status === "error" || templates.status === "error") && (
          <button type="button" className={`mt-3 ${linkClass}`} onClick={refreshLists}>Tentar carregar novamente</button>
        )}
      </section>
    </div>
  );
}
