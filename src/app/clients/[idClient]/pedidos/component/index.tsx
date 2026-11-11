"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UserRound,
  Phone,
  MapPin,
  MapPinned,
  House,
  Hash,
  FileText,
  X,
  Check,
  Truck,
  Loader2,
} from "lucide-react";

export const addressSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  phone: z
    .string()
    .min(11, "O telefone deve ter pelo menos 11 dígitos")
    .max(15, "Telefone muito longo"),
  cidade: z.string().min(1, "A cidade é obrigatória"),
  bairro: z.string().min(1, "Selecione um bairro"),
  rua: z.string().min(1, "A rua é obrigatória"),
  numero: z.string().min(1, "O número é obrigatório"),
  id: z.string().optional(),
  complemento: z.string().optional(),
});

export type AddressData = z.infer<typeof addressSchema>;

export interface Bairro {
  id: string;
  bairro: string;
  frete: number | string;
}

interface FormClientProps {
  onSubmitAddress: (data: AddressData) => void | Promise<void>;
  handleActive: () => void;
  initialData?: AddressData | null;
  bairros: Bairro[];
  loadingBairros?: boolean;
  identityReadOnly?: boolean;
  busy?: boolean;
}

function formatarFrete(valor: number | string) {
  const frete = Number(valor);

  if (!Number.isFinite(frete)) {
    return "Valor indisponível";
  }

  if (frete === 0) {
    return "Entrega grátis";
  }

  return frete.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function FormClient({
  onSubmitAddress,
  handleActive,
  initialData,
  bairros,
  loadingBairros = false,
  identityReadOnly = false,
  busy = false,
}: FormClientProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddressData>({
    resolver: zodResolver(identityReadOnly ? addressSchema.extend({ phone: z.string().min(1, "Telefone do cadastro ausente") }) : addressSchema),
    defaultValues: initialData ?? {
      name: "",
      phone: "",
      cidade: "",
      bairro: "",
      rua: "",
      numero: "",
      complemento: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  const bairroAtual = watch("bairro");

  const bairroSelecionado = bairros.find((item) => item.bairro === bairroAtual);

  function handleRegister(data: AddressData) {
    const bairroValido = bairros.some((item) => item.bairro === data.bairro);

    if (!bairroValido) {
      return;
    }

    onSubmitAddress(data);
  }

  const inputClass =
    "w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

  const labelClass =
    "mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700";

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-orange-50 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white">
            <MapPinned size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold">Endereço de entrega</h2>

            <p className="mt-1 text-xs text-slate-500">
              Informe onde deseja receber seu pedido
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleActive}
          disabled={busy}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-orange-100 hover:text-orange-600"
          aria-label="Fechar formulário"
        >
          <X size={22} />
        </button>
      </div>

      {/* FORMULÁRIO */}
      <form
        onSubmit={handleSubmit(handleRegister)}
        className="max-h-[75vh] space-y-5 overflow-y-auto p-5"
      >
        <fieldset disabled={busy}>
        {/* DADOS PESSOAIS */}
        <div>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Dados do cliente
          </h3>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                <UserRound size={16} className="text-orange-500" />
                Nome completo
              </label>

              <input
                {...register("name")}
                readOnly={identityReadOnly}
                placeholder="Seu nome"
                className={inputClass}
              />

              {errors.name && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <Phone size={16} className="text-orange-500" />
                Telefone
              </label>

              <input
                {...register("phone")}
                readOnly={identityReadOnly}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />

              {errors.phone && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* ENDEREÇO */}
        <div>
          <h3 className="mb-4 text-sm font-bold text-slate-900">
            Local de entrega
          </h3>

          <div className="space-y-4">
            {/* BAIRRO */}
            <div>
              <label className={labelClass}>
                <MapPin size={16} className="text-orange-500" />
                Bairro de entrega
              </label>

              <select
                {...register("bairro")}
                disabled={loadingBairros || bairros.length === 0}
                className={inputClass}
              >
                <option value="">
                  {loadingBairros
                    ? "Carregando bairros..."
                    : "Selecione seu bairro"}
                </option>

                {bairros.map((item) => (
                  <option key={item.id} value={item.bairro}>
                    {item.bairro} — {formatarFrete(item.frete)}
                  </option>
                ))}
              </select>

              {errors.bairro && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.bairro.message}
                </p>
              )}

              {!loadingBairros && bairros.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Nenhum bairro disponível para entrega.
                </p>
              )}

              {bairroSelecionado && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 p-3">
                  <div className="flex items-center gap-2">
                    <Truck size={19} className="text-orange-500" />

                    <span className="text-sm text-slate-600">
                      Taxa de entrega
                    </span>
                  </div>

                  <span
                    className={`text-sm font-bold ${
                      Number(bairroSelecionado.frete) === 0
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {formatarFrete(bairroSelecionado.frete)}
                  </span>
                </div>
              )}
            </div>

            {/* CIDADE */}
            <div>
              <label className={labelClass}>
                <MapPinned size={16} className="text-orange-500" />
                Cidade
              </label>

              <input
                {...register("cidade")}
                placeholder="Sua cidade"
                className={inputClass}
              />

              {errors.cidade && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.cidade.message}
                </p>
              )}
            </div>

            {/* RUA */}
            <div>
              <label className={labelClass}>
                <House size={16} className="text-orange-500" />
                Rua
              </label>

              <input
                {...register("rua")}
                placeholder="Nome da rua"
                className={inputClass}
              />

              {errors.rua && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.rua.message}
                </p>
              )}
            </div>

            {/* NÚMERO E COMPLEMENTO */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  <Hash size={16} className="text-orange-500" />
                  Número
                </label>

                <input
                  {...register("numero")}
                  placeholder="Ex.: 125"
                  className={inputClass}
                />

                {errors.numero && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.numero.message}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  <FileText size={16} className="text-orange-500" />
                  Complemento
                </label>

                <input
                  {...register("complemento")}
                  placeholder="Casa, apartamento..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SALVAR */}
        <button
          type="submit"
          disabled={loadingBairros || bairros.length === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={19} />
          {busy ? "Confirmando…" : "Confirmar identificação e entrega"}
        </button>
        </fieldset>
      </form>
    </div>
  );
}
