"use client";

import { useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Loader2,
  MapPin,
  PlusCircle,
  Save,
  Truck,
  X,
} from "lucide-react";

import { Context } from "@/app/Context";

const schema = z.object({
  bairro: z.string().trim().min(1, "O nome do bairro é obrigatório."),

  valor: z
    .string()
    .trim()
    .min(1, "O valor é obrigatório.")
    .regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido, como 5,50."),
});

type BairroProps = z.infer<typeof schema>;

export function BairrosComponente() {
  const [loading, setLoading] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const { lanchoneteProfile } = useContext(Context);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BairroProps>({
    resolver: zodResolver(schema),
    defaultValues: {
      bairro: "",
      valor: "",
    },
  });

  async function onSubmit(data: BairroProps) {
    setErroCadastro("");
    setSucesso("");

    if (!lanchoneteProfile?.id) {
      setErroCadastro("Lanchonete não identificada. Faça login novamente.");
      return;
    }

    setLoading(true);

    const valorFormatado = Number(data.valor.replace(",", "."));

    try {
      const response = await fetch("/api/bairros", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bairro: data.bairro.trim(),
          valor: valorFormatado,
          lanchonete_id: lanchoneteProfile.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message || "Não foi possível cadastrar o bairro.",
        );
      }

      reset();

      setSucesso("Bairro cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao cadastrar bairro:", error);

      setErroCadastro(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o bairro.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* FORMULÁRIO */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-3">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <MapPin size={23} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Cadastrar novo bairro
            </h2>

            <p className="text-xs text-slate-500">
              Informe o bairro e sua taxa de entrega.
            </p>
          </div>
        </div>

        {/* ALERTAS */}
        {erroCadastro && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <CircleAlert size={19} />
            <span className="flex-1">{erroCadastro}</span>

            <button
              type="button"
              onClick={() => setErroCadastro("")}
              aria-label="Fechar mensagem"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {sucesso && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            <CheckCircle2 size={19} />
            <span className="flex-1">{sucesso}</span>

            <button
              type="button"
              onClick={() => setSucesso("")}
              aria-label="Fechar mensagem"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* NOME DO BAIRRO */}
          <div>
            <label
              htmlFor="bairro"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Nome do bairro
              <span className="ml-1 text-red-500">*</span>
            </label>

            <div className="relative">
              <MapPin
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="bairro"
                type="text"
                placeholder="Ex: Centro"
                {...register("bairro")}
                className={`${inputClass} pl-12 ${
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

          {/* TAXA DE ENTREGA */}
          <div>
            <label
              htmlFor="valor"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Taxa de entrega
              <span className="ml-1 text-red-500">*</span>
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-500">
                R$
              </span>

              <input
                id="valor"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 5,50"
                {...register("valor")}
                className={`${inputClass} pl-12 ${
                  errors.valor ? "border-red-400" : ""
                }`}
              />
            </div>

            {errors.valor && (
              <p className="mt-1.5 text-xs text-red-500">
                {errors.valor.message}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-400">
              Para entrega gratuita, informe 0,00.
            </p>
          </div>

          {/* BOTÕES */}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                reset();
                setErroCadastro("");
                setSucesso("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Limpar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Cadastrar bairro
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* CARD INFORMATIVO */}
      <aside className="space-y-5 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Truck size={25} />
          </div>

          <h3 className="text-lg font-semibold text-slate-900">
            Áreas de entrega
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Cadastre os bairros atendidos pela lanchonete e defina a taxa
            cobrada para cada região.
          </p>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-3">
              <MapPin size={19} className="mt-0.5 shrink-0 text-orange-500" />

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Identifique a região
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Informe o nome pelo qual os clientes conhecem o bairro.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CircleDollarSign
                size={19}
                className="mt-0.5 shrink-0 text-orange-500"
              />

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Defina o valor
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  A taxa será associada ao bairro cadastrado.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
          <div className="flex items-center gap-2 text-orange-700">
            <PlusCircle size={18} />
            <span className="text-sm font-semibold">Dica de organização</span>
          </div>

          <p className="mt-2 text-xs leading-6 text-orange-700">
            Utilize sempre o mesmo padrão de nomes para evitar cadastrar bairros
            duplicados.
          </p>
        </div>
      </aside>
    </div>
  );
}
