"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Truck,
  X,
} from "lucide-react";

import { Bairros } from "@/app/models/interface";

const schema = z.object({
  id: z.union([z.string(), z.number()]).optional(),

  bairro: z.string().trim().min(1, "O nome do bairro é obrigatório."),

  frete: z
    .string()
    .trim()
    .min(1, "O valor é obrigatório.")
    .regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido, como 5,50."),
});

type BairroProps = z.infer<typeof schema>;

// Converte o valor recebido em texto para o formulário.
// Exemplo: 5.5 -> "5,50"
function formatarFrete(valor: string | number): string {
  const numero = Number(String(valor).replace(",", "."));

  if (!Number.isFinite(numero)) {
    return "0,00";
  }

  return numero.toFixed(2).replace(".", ",");
}

// Formulário individual de cada bairro
function EditarBairros({
  item,
  onAtualizado,
}: {
  item: Bairros;
  onAtualizado: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<BairroProps>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: item.id,
      bairro: item.bairro,
      frete: formatarFrete(item.frete),
    },
  });

  useEffect(() => {
    reset({
      id: item.id,
      bairro: item.bairro,
      frete: formatarFrete(item.frete),
    });
  }, [item, reset]);

  async function onSubmit(data: BairroProps) {
    setLoading(true);
    setErroCadastro("");
    setSucesso("");

    try {
      const formData = new FormData();

      formData.append("id", String(data.id ?? ""));
      formData.append("bairro", data.bairro.trim());

      // Envia a taxa com ponto decimal para o backend.
      // Exemplo: "5,50" -> "5.50"
      formData.append("frete", data.frete.replace(",", "."));

      const response = await fetch("/api/bairros", {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(errorData.message || "Falha ao atualizar o bairro.");
      }

      setSucesso("Bairro atualizado com sucesso!");

      // Atualiza a lista após salvar
      onAtualizado();
    } catch (error) {
      console.error("Erro ao atualizar bairro:", error);

      setErroCadastro(
        error instanceof Error
          ? error.message
          : "Não foi possível editar o bairro.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* CABEÇALHO DO CARD */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <MapPin size={21} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {item.bairro}
            </h3>

            <p className="mt-1 text-xs text-slate-500">Região de entrega</p>
          </div>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600">
          <Pencil size={12} />
          Editar
        </span>
      </div>

      {/* FORMULÁRIO */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-5">
        <div>
          <label
            htmlFor={`bairro-${item.id}`}
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Nome do bairro
          </label>

          <div className="relative">
            <MapPin
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              id={`bairro-${item.id}`}
              type="text"
              placeholder="Nome do bairro"
              {...register("bairro")}
              className={`${inputClass} pl-11 ${
                errors.bairro ? "border-red-400" : ""
              }`}
            />
          </div>

          {errors.bairro && (
            <p className="mt-1.5 text-xs text-red-500">
              {errors.bairro.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`frete-${item.id}`}
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Taxa de entrega
          </label>

          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-500">
              R$
            </span>

            <input
              id={`frete-${item.id}`}
              type="text"
              inputMode="decimal"
              placeholder="Ex: 5,50"
              {...register("frete")}
              className={`${inputClass} pl-12 ${
                errors.frete ? "border-red-400" : ""
              }`}
            />
          </div>

          {errors.frete && (
            <p className="mt-1.5 text-xs text-red-500">
              {errors.frete.message}
            </p>
          )}
        </div>

        {/* MENSAGENS */}
        {erroCadastro && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            <CircleAlert size={17} className="shrink-0" />
            <span className="flex-1">{erroCadastro}</span>

            <button
              type="button"
              onClick={() => setErroCadastro("")}
              aria-label="Fechar erro"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {sucesso && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-700"
          >
            <CheckCircle2 size={17} className="shrink-0" />
            <span className="flex-1">{sucesso}</span>

            <button
              type="button"
              onClick={() => setSucesso("")}
              aria-label="Fechar mensagem"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* BOTÃO */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Salvando alterações...
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </form>
    </article>
  );
}

// Lista dos bairros cadastrados
export function BairroEdit() {
  const [listaBairros, setListaBairros] = useState<Bairros[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [erro, setErro] = useState("");

  async function GetBairros() {
    setLoading(true);
    setErro("");

    try {
      const response = await fetch("/api/bairros", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível carregar os bairros.");
      }

      const dados: Bairros[] = await response.json();

      setListaBairros(dados);
    } catch (error) {
      console.error("Erro ao buscar bairros:", error);

      setErro(
        error instanceof Error ? error.message : "Erro ao carregar bairros.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    GetBairros();
  }, []);

  const bairrosFiltrados = listaBairros.filter((item) =>
    item.bairro.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* BARRA DE BUSCA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Bairros cadastrados
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {listaBairros.length} bairros disponíveis para edição
            </p>
          </div>

          <button
            type="button"
            onClick={GetBairros}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar lista
          </button>
        </div>

        <div className="relative mt-5">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Buscar bairro pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
          />
        </div>
      </div>

      {/* ERRO DE CARREGAMENTO */}
      {erro && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <CircleAlert size={20} />
          {erro}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 size={32} className="animate-spin text-orange-500" />

          <p className="mt-3 text-sm text-slate-500">Carregando bairros...</p>
        </div>
      )}

      {/* CARDS */}
      {!loading && !erro && bairrosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {bairrosFiltrados.map((item) => (
            <EditarBairros
              key={item.id}
              item={item}
              onAtualizado={GetBairros}
            />
          ))}
        </div>
      )}

      {/* NENHUM BAIRRO */}
      {!loading && !erro && bairrosFiltrados.length === 0 && (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center">
          <MapPin size={42} className="text-slate-300" />

          <h3 className="mt-4 text-base font-semibold text-slate-800">
            Nenhum bairro encontrado
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            {search
              ? "Tente pesquisar por outro nome."
              : "Ainda não existem bairros cadastrados."}
          </p>
        </div>
      )}
    </div>
  );
}
