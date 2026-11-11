"use client";

import { useContext, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import {
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  Loader2,
  PackagePlus,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import { Context } from "@/app/Context";
import ConfiguredProductForm from "./ConfiguredProductForm";

const schema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  price: z
    .string()
    .trim()
    .min(1, "Preço é obrigatório")
    .refine((value) => {
      const numero = Number(value.replace(",", "."));
      return Number.isFinite(numero) && numero > 0;
    }, "Informe um preço válido maior que zero"),
  image: z
    .instanceof(File, { error: "Selecione uma imagem" })
    .refine((file) => file.size > 0, "Selecione uma imagem válida")
    .refine(
      (file) => file.type.startsWith("image/"),
      "O arquivo precisa ser uma imagem",
    ),
});

type FormValues = z.infer<typeof schema>;

export default function Produtos() {
  const [mode, setMode] = useState<"simple" | "configured">("simple");
  const [configuredOpened, setConfiguredOpened] = useState(false);
  const [draftId, setDraftId] = useState("");

  useEffect(() => {
    const initialDraft = new URLSearchParams(window.location.search).get("draft");
    if (initialDraft) {
      setDraftId(initialDraft);
      setConfiguredOpened(true);
      setMode("configured");
    }
  }, []);

  function changeDraft(id: string) {
    setDraftId(id);
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("draft", id);
    } else {
      url.searchParams.delete("draft");
    }
    window.history.replaceState(null, "", url);
  }

  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const { lanchoneteProfile } = useContext(Context);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(image);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleRegister = async (data: FormValues) => {
    setMensagem("");

    if (lanchoneteProfile?.id == null) {
      setMensagem("❌ Lanchonete não identificada.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("price", data.price.replace(",", "."));
      formData.append("file", data.image);

      const response = await fetch("/api/product", {
        method: "POST",
        body: formData,
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.message || "Não foi possível cadastrar o produto.",
        );
      }

      setMensagem("✅ Produto cadastrado com sucesso!");

      reset();
      setImage(null);
      setPreview(null);
    } catch (error) {
      console.error("Erro ao cadastrar produto:", error);

      setMensagem(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Erro inesperado ao cadastrar produto.",
      );
    } finally {
      setLoading(false);
    }
  };

  const sucesso = mensagem.startsWith("✅");

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <PackagePlus size={16} />
            <span>Gerenciamento de produtos</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cadastrar novo produto
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Adicione um novo item ao cardápio da sua lanchonete.
          </p>
        </header>

        <fieldset className="mb-6 grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-slate-700">Tipo de produto</legend>
          {([
            ["simple", "Simples", "Um produto com preço único."],
            ["configured", "Configurável", "Um produto com tamanhos e grupos de escolhas."],
          ] as const).map(([value, label, description]) => (
            <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 ${mode === value ? "border-orange-500" : "border-slate-200"}`}>
              <input type="radio" name="product-mode" value={value} checked={mode === value}
                className="accent-orange-600" onChange={() => {
                  setMode(value);
                  if (value === "configured") setConfiguredOpened(true);
                }} />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                <span className="block text-sm text-slate-600">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {configuredOpened && (
          <div hidden={mode !== "configured"}>
            <ConfiguredProductForm draftId={draftId} onDraftChange={changeDraft} />
          </div>
        )}

        {/* MENSAGEM DE RETORNO */}
        {mode === "simple" && mensagem && (
          <div
            role="alert"
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
              sucesso
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {sucesso ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}

            <span>{mensagem}</span>

            <button
              type="button"
              onClick={() => setMensagem("")}
              className="ml-auto"
              aria-label="Fechar mensagem"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <form hidden={mode !== "simple"} onSubmit={handleSubmit(handleRegister)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* DADOS DO PRODUTO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-3">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <PackagePlus size={22} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Informações do produto
                  </h2>
                  <p className="text-xs text-slate-500">
                    Preencha os dados do item.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* NOME */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Nome do produto
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <input
                    id="name"
                    type="text"
                    placeholder="Ex: X-Bacon Especial"
                    {...register("name")}
                    className={`${inputClass} ${
                      errors.name ? "border-red-400" : ""
                    }`}
                  />

                  {errors.name && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* DESCRIÇÃO */}
                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Descrição
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <textarea
                    id="description"
                    rows={5}
                    placeholder="Ex: Pão artesanal, hambúrguer, queijo, bacon crocante e molho especial..."
                    {...register("description")}
                    className={`${inputClass} resize-none ${
                      errors.description ? "border-red-400" : ""
                    }`}
                  />

                  {errors.description && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {errors.description.message}
                    </p>
                  )}

                  <p className="mt-1.5 text-xs text-slate-400">
                    Descreva os ingredientes e detalhes do produto.
                  </p>
                </div>

                {/* PREÇO */}
                <div>
                  <label
                    htmlFor="price"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Preço de venda
                    <span className="ml-1 text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-500">
                      R$
                    </span>

                    <input
                      id="price"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      {...register("price")}
                      className={`${inputClass} pl-12 ${
                        errors.price ? "border-red-400" : ""
                      }`}
                    />
                  </div>

                  {errors.price && (
                    <p className="mt-1.5 text-xs text-red-500">
                      {errors.price.message}
                    </p>
                  )}

                  <p className="mt-1.5 text-xs text-slate-400">
                    Exemplo: 25,90
                  </p>
                </div>
              </div>
            </section>

            {/* UPLOAD DA IMAGEM */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <ImagePlus size={22} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Imagem do produto
                  </h2>
                  <p className="text-xs text-slate-500">
                    Escolha uma foto para o cardápio.
                  </p>
                </div>
              </div>

              <Controller
                name="image"
                control={control}
                render={({ field }) => (
                  <div>
                    <label
                      htmlFor="product-image"
                      className={`group flex min-h-[290px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                        errors.image
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-slate-50 hover:border-orange-400 hover:bg-orange-50/40"
                      }`}
                    >
                      <input
                        id="product-image"
                        type="file"
                        accept="image/*"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          const file = e.target.files?.[0];

                          field.onChange(file);
                          setImage(file ?? null);
                        }}
                        className="sr-only"
                      />

                      {preview ? (
                        <div className="relative h-[290px] w-full">
                          <Image
                            src={preview}
                            alt="Prévia do produto"
                            fill
                            unoptimized
                            className="object-cover"
                          />

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-12 text-center text-sm font-medium text-white">
                            Clique para trocar a imagem
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center px-6 text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
                            <UploadCloud size={32} />
                          </div>

                          <p className="text-sm font-semibold text-slate-700">
                            Clique para enviar uma imagem
                          </p>

                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            Escolha uma foto do seu produto
                          </p>

                          <span className="mt-5 rounded-lg border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
                            Selecionar arquivo
                          </span>
                        </div>
                      )}
                    </label>

                    {errors.image && (
                      <p className="mt-2 text-xs text-red-500">
                        {errors.image.message}
                      </p>
                    )}

                    {image && (
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-700">
                            {image.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {(image.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label="Remover imagem"
                          onClick={() => {
                            field.onChange(undefined);
                            setImage(null);
                            setValue("image", undefined as unknown as File, {
                              shouldValidate: true,
                            });
                          }}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              />

              <div className="mt-5 rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-semibold text-orange-800">
                  Dica para uma boa foto
                </p>

                <p className="mt-1 text-xs leading-5 text-orange-700">
                  Prefira imagens bem iluminadas, com o produto centralizado e
                  fundo limpo.
                </p>
              </div>
            </section>
          </div>

          {/* AÇÕES */}
          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:p-5">
            <p className="text-xs text-slate-400">
              Os campos marcados com * são obrigatórios.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  reset();
                  setImage(null);
                  setMensagem("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Limpar formulário
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Cadastrar produto
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
