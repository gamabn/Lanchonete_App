"use client";

import { useContext, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Context } from "@/app/Context";
import { categorySuggestions, categoryValue } from "./productCategory";

export function useProductCategories() {
  const { lanchoneteProfile } = useContext(Context);
  const tenant = lanchoneteProfile?.id;
  const [loaded, setLoaded] = useState<{ tenant: string; values: string[] }>();
  useEffect(() => {
    if (!tenant) return;
    const controller = new AbortController();
    void fetch("/api/product", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Categorias indisponíveis.");
        const products = await response.json();
        if (!Array.isArray(products)) throw new Error("Lista inválida.");
        if (!controller.signal.aborted) setLoaded({ tenant, values: categorySuggestions(products, tenant) });
      }).catch(() => { if (!controller.signal.aborted) setLoaded({ tenant, values: [] }); });
    return () => controller.abort();
  }, [tenant]);
  return loaded?.tenant === tenant ? loaded?.values ?? [] : [];
}

type Props = Omit<ComponentProps<"input">, "list"> & { suggestions: string[] };

export default function CategoryField({ suggestions, id, onInput, ref, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    const clearValidity = () => input?.setCustomValidity("");
    form?.addEventListener("reset", clearValidity);
    return () => form?.removeEventListener("reset", clearValidity);
  }, []);
  const uniqueId = useId();
  const inputId = id ?? `category-${uniqueId}`;
  const listId = `${inputId}-suggestions`;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">Categoria do produto (opcional)</label>
      <input {...props} ref={node => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }} id={inputId} name={props.name ?? "category"} type="text" list={listId}
        aria-describedby={`${inputId}-help`} onInput={event => {
          try { categoryValue(event.currentTarget.value); event.currentTarget.setCustomValidity(""); }
          catch (error) { event.currentTarget.setCustomValidity((error as Error).message); }
          onInput?.(event);
        }} />
      <datalist id={listId}>{suggestions.map(value => <option key={value} value={value} />)}</datalist>
      <p id={`${inputId}-help`} className="text-xs text-slate-500">Escolha uma sugestão ou digite uma nova categoria. Até 80 caracteres.</p>
    </div>
  );
}
