"use client";

import { useEffect, useRef, useState } from "react";
import type { CartProduct, Product, PublicProductConfiguration } from "@/app/models/interface";
import { configuredCartProduct, loadPublicConfiguration } from "@/app/util/checkout";
import { formatarPreco } from "@/app/components/money";

export default function ProductConfigurationDialog({ product, restaurantId, onClose, onAdd }: {
  product: Product;
  restaurantId: string;
  onClose: () => void;
  onAdd: (product: CartProduct) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const adding = useRef(false);
  const [configuration, setConfiguration] = useState<PublicProductConfiguration>();
  const [variantId, setVariantId] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    setError("");
    setConfiguration(undefined);
    setVariantId("");
    setOptions([]);
    loadPublicConfiguration(product.id, restaurantId)
      .then((data) => { if (active) setConfiguration(data); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "Falha ao carregar o produto."); });
    return () => { active = false; };
  }, [product.id, restaurantId, revision]);

  let valid: CartProduct | undefined;
  let estimate: number | undefined;
  let validation = "";
  if (configuration && variantId) {
    try {
      estimate = configuredCartProduct(configuration, restaurantId, variantId, options, false).price;
      valid = configuredCartProduct(configuration, restaurantId, variantId, options);
    } catch (failure) {
      validation = failure instanceof Error ? failure.message : "Revise suas escolhas.";
    }
  }
  const variant = configuration?.variants.find((item) => item.id === variantId);

  return (
    <dialog ref={dialog} onCancel={onClose} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }} aria-labelledby="configuration-title"
      className="m-auto max-h-[90dvh] w-[min(94vw,40rem)] overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/60">
      <div className="p-5 sm:p-7">
        <header className="flex items-start justify-between gap-3">
          <h2 id="configuration-title" className="text-xl font-bold">{product.name}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Fechar</button>
        </header>
        {error && (
          <div className="mt-4 space-y-3">
            <p role="alert" className="text-sm text-red-700">{error}</p>
            {!configuration && <button type="button" className="text-sm font-semibold text-orange-700" onClick={() => setRevision((value) => value + 1)}>Tentar carregar novamente</button>}
          </div>
        )}
        {!configuration && !error && <p role="status" className="mt-5">Carregando opções…</p>}
        {configuration && (
          <form className="mt-5 space-y-5" onSubmit={(event) => {
            event.preventDefault();
            if (!valid || adding.current) return;
            adding.current = true;
            try {
              onAdd(valid);
              onClose();
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Não foi possível adicionar ao carrinho.");
              adding.current = false;
            }
          }}>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">Escolha o tamanho</legend>
              {configuration.variants.length === 0 && <p className="text-sm text-red-700">Nenhum tamanho disponível.</p>}
              {configuration.variants.map((item) => (
                <label key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="size" checked={variantId === item.id} onChange={() => {
                      setVariantId(item.id);
                      setOptions([]);
                      setError("");
                    }} />{item.name}
                  </span>
                  <span>{formatarPreco(item.price)}</span>
                </label>
              ))}
            </fieldset>
            {variant && configuration.groups.map((group) => {
              const limit = variant.groupLimits.find((item) => item.groupId === group.id);
              const selectedCount = group.options.filter((item) => options.includes(item.id)).length;
              return (
                <fieldset key={group.id} disabled={!limit} className="space-y-2 border-t border-slate-200 pt-4">
                  <legend className="font-semibold">{group.name}</legend>
                  <p className="text-sm text-slate-500">
                    {limit ? `Escolha de ${limit.minSelect} a ${limit.maxSelect} · ${selectedCount} selecionadas` : "Indisponível para este tamanho."}
                  </p>
                  {group.options.length === 0 && <p className="text-sm text-slate-500">Nenhuma opção disponível.</p>}
                  {group.options.map((option) => {
                    const selected = options.includes(option.id);
                    const full = limit && selectedCount >= limit.maxSelect;
                    return (
                      <label key={option.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={selected} disabled={!selected && Boolean(full)} onChange={() => {
                            setOptions((current) => selected ? current.filter((id) => id !== option.id) : [...current, option.id]);
                            setError("");
                          }} />{option.name}
                        </span>
                        <span>{Number(option.additional_price) === 0 ? "Grátis" : `+ ${formatarPreco(option.additional_price)}`}</span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
            {validation && <p className="text-sm text-orange-800" role="status">{validation}</p>}
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">Preço estimado <strong className="block text-lg text-orange-700">{estimate === undefined ? "Selecione o tamanho" : formatarPreco(estimate)}</strong></p>
              <button type="submit" disabled={!valid} className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300">Adicionar ao carrinho</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
