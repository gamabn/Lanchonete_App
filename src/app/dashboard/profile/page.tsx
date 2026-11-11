"use client";

import { useContext, useEffect, useState } from "react";
import Image from "next/image";
import {
  Building2,
  Camera,
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Save,
  Store,
  UserRound,
  X,
} from "lucide-react";

import { Context } from "@/app/Context";
import { toast } from "react-toastify";

interface Lanchonete {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  image_url: string;
}

const emptyProfile: Lanchonete = {
  id: "",
  name: "",
  phone: "",
  email: "",
  city: "",
  neighborhood: "",
  street: "",
  number: "",
  image_url: "",
};

export default function Profile() {
  const { lanchoneteProfile } = useContext(Context);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formMessage, setFormMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [lanchonete, setLanchonete] = useState<Lanchonete>(emptyProfile);

  // Preenche o formulário quando os dados chegarem do Context
  useEffect(() => {
    if (!lanchoneteProfile) return;

    setLanchonete({
      id: String(lanchoneteProfile.id ?? ""),
      name: String(lanchoneteProfile.name ?? ""),
      phone: String(lanchoneteProfile.phone ?? ""),
      email: String(lanchoneteProfile.email ?? ""),
      city: String(lanchoneteProfile.city ?? ""),
      neighborhood: String(lanchoneteProfile.neighborhood ?? ""),
      street: String(lanchoneteProfile.street ?? ""),
      number: String(lanchoneteProfile.number ?? ""),
      image_url: String(lanchoneteProfile.image_url ?? ""),
    });
  }, [lanchoneteProfile]);

  // Gera e limpa a prévia da imagem
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(image);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleChange = (field: keyof Lanchonete, value: string) => {
    setLanchonete((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  async function handleEditProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFormMessage(null);

    if (!lanchonete.id) {
      setFormMessage({
        type: "error",
        text: "Lanchonete não identificada.",
      });
      return;
    }

    if (!lanchonete.name.trim()) {
      setFormMessage({
        type: "error",
        text: "Informe o nome da lanchonete.",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Atualiza a imagem somente se outra foi selecionada
      if (image) {
        const formData = new FormData();
        formData.append("file", image);

        const imageResponse = await fetch("/api/store-image", { method: "PUT", body: formData });
        if (!imageResponse.ok) throw new Error("Não foi possível atualizar a imagem.");
      }

      // 2. Atualiza os dados da lanchonete
      const response = await fetch("/api/user/", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lanchonete.id,
          name: lanchonete.name,
          email: lanchonete.email,
          phone: lanchonete.phone,
          city: lanchonete.city,
          neighborhood: lanchonete.neighborhood,
          street: lanchonete.street,
          number: lanchonete.number,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message || "Não foi possível atualizar o perfil.",
        );
      }

      setFormMessage({
        type: "success",
        text: "Perfil atualizado com sucesso!",
      });

      toast.success("Perfil atualizado com sucesso!");

      // Remove o arquivo selecionado após salvar
      setImage(null);
    } catch (error) {
      console.error("Erro ao editar perfil:", error);

      const message =
        error instanceof Error ? error.message : "Erro ao atualizar o perfil.";

      setFormMessage({
        type: "error",
        text: message,
      });

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

  const imageSrc = preview || lanchonete.image_url || "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Store size={17} />
            <span>Configurações da lanchonete</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Perfil da lanchonete
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Gerencie as informações, os dados de contato e o endereço do seu
            estabelecimento.
          </p>
        </header>

        {/* MENSAGENS */}
        {formMessage && (
          <div
            role="alert"
            className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              formMessage.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {formMessage.type === "success" ? (
              <CheckCircle2 size={20} />
            ) : (
              <CircleAlert size={20} />
            )}

            <span className="flex-1">{formMessage.text}</span>

            <button
              type="button"
              onClick={() => setFormMessage(null)}
              aria-label="Fechar mensagem"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <form onSubmit={handleEditProfile}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* CARD DO PERFIL */}
            <aside className="space-y-6 lg:col-span-2">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* FAIXA SUPERIOR */}
                <div className="h-28 bg-gradient-to-r from-orange-500 to-amber-400" />

                <div className="relative px-6 pb-7 text-center">
                  {/* FOTO */}
                  <div className="-mt-14 flex justify-center">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt="Imagem da lanchonete"
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-300">
                          <Store size={48} />
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-4 text-lg font-bold text-slate-900">
                    {lanchonete.name || "Minha lanchonete"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Perfil do estabelecimento
                  </p>

                  {/* TROCAR FOTO */}
                  <label className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-500 hover:text-white">
                    <Camera size={18} />
                    Alterar imagem
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];

                        if (!file) return;

                        if (!file.type.startsWith("image/")) {
                          toast.error("Selecione um arquivo de imagem válido.");
                          return;
                        }

                        setImage(file);
                      }}
                    />
                  </label>

                  {image && (
                    <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-left">
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {image.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {(image.size / 1024 / 1024).toFixed(2)} MB
                      </p>

                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        Cancelar troca de imagem
                      </button>
                    </div>
                  )}
                </div>

                {/* INFORMAÇÕES */}
                <div className="space-y-4 border-t border-slate-100 px-6 py-6">
                  <div className="flex items-start gap-3">
                    <Mail
                      size={18}
                      className="mt-0.5 shrink-0 text-orange-500"
                    />

                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">E-mail</p>

                      <p className="mt-1 break-all text-sm font-medium text-slate-700">
                        {lanchonete.email || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone
                      size={18}
                      className="mt-0.5 shrink-0 text-orange-500"
                    />

                    <div>
                      <p className="text-xs text-slate-400">Telefone</p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {lanchonete.phone || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin
                      size={18}
                      className="mt-0.5 shrink-0 text-orange-500"
                    />

                    <div>
                      <p className="text-xs text-slate-400">Localização</p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {[lanchonete.neighborhood, lanchonete.city]
                          .filter(Boolean)
                          .join(" - ") || "Não informada"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* DICA */}
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                  <ImagePlus size={19} />
                  Imagem do estabelecimento
                </div>

                <p className="mt-2 text-xs leading-6 text-orange-700">
                  Utilize uma imagem nítida do logotipo ou da fachada da
                  lanchonete para facilitar a identificação do estabelecimento.
                </p>
              </div>
            </aside>

            {/* FORMULÁRIO */}
            <div className="space-y-6 lg:col-span-3">
              {/* INFORMAÇÕES GERAIS */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-7 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <Building2 size={22} />
                  </div>

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Informações gerais
                    </h2>

                    <p className="text-xs text-slate-500">
                      Dados principais do estabelecimento.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Nome da lanchonete
                    </label>

                    <div className="relative">
                      <Store
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="name"
                        type="text"
                        value={lanchonete.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        className={`${inputClass} pl-12`}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      E-mail
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="email"
                        type="email"
                        value={lanchonete.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className={`${inputClass} pl-12`}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Telefone
                    </label>

                    <div className="relative">
                      <Phone
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="phone"
                        type="tel"
                        value={lanchonete.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className={`${inputClass} pl-12`}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* ENDEREÇO */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-7 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <MapPinned size={22} />
                  </div>

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Endereço da lanchonete
                    </h2>

                    <p className="text-xs text-slate-500">
                      Informe onde seu estabelecimento está localizado.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="city"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Cidade
                    </label>

                    <input
                      id="city"
                      type="text"
                      value={lanchonete.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Nome da cidade"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="neighborhood"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Bairro
                    </label>

                    <input
                      id="neighborhood"
                      type="text"
                      value={lanchonete.neighborhood}
                      onChange={(e) =>
                        handleChange("neighborhood", e.target.value)
                      }
                      placeholder="Nome do bairro"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="street"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Rua
                    </label>

                    <input
                      id="street"
                      type="text"
                      value={lanchonete.street}
                      onChange={(e) => handleChange("street", e.target.value)}
                      placeholder="Nome da rua"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="number"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Número
                    </label>

                    <input
                      id="number"
                      type="text"
                      value={lanchonete.number}
                      onChange={(e) => handleChange("number", e.target.value)}
                      placeholder="Ex: 123"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Confira os dados antes de salvar as alterações.
            </p>

            <button
              type="submit"
              disabled={loading || !lanchonete.id}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  Salvando alterações...
                </>
              ) : (
                <>
                  <Save size={19} />
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
