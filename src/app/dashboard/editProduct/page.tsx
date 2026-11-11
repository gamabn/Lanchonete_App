"use client";

import { useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Context } from "@/app/Context";
import { toast } from "react-toastify";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number | string;
  image_url: string;
  public_id: string;
  restaurant_id: string;
  has_variants?: boolean;
}

// Converte o valor do banco para reais.
// Exemplo: 15 -> "15,00"
function formatPrice(value: number | string): string {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return "0,00";
  }

  return numero.toFixed(2).replace(".", ",");
}

// Converte o texto digitado para um número em reais.
// Exemplo: "15,90" -> 15.9
function parsePrice(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }

  const texto = value.replace(/R\$/g, "").replace(/\s/g, "").trim();

  // Aceita "1.250,90" e "15,90"
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  return Number(normalizado);
}

export default function EditProduct() {
  const { user, lanchoneteProfile } = useContext(Context);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [filesToUpload, setFilesToUpload] = useState<{
    [productId: string]: File;
  }>({});

  const [previews, setPreviews] = useState<{
    [productId: string]: string;
  }>({});

  const [priceInputs, setPriceInputs] = useState<{
    [productId: string]: string;
  }>({});

  const [refreshKey, setRefreshKey] = useState(0);

  // Buscar produtos
  useEffect(() => {
    let ativo = true;

    async function fetchProducts() {
      setLoadingProducts(true);

      try {
        const response = await fetch("/api/product", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Falha ao buscar produtos: ${response.status}`);
        }

        const res: Product[] = await response.json();

        if (!ativo) return;

        const formattedProducts = res.map((product) => ({
          ...product,
          price: Number(product.price) || 0,
        }));

        setProducts(formattedProducts);

        // Preços da interface, sempre em reais
        const prices: Record<string, string> = {};

        formattedProducts.forEach((product) => {
          prices[product.id] = formatPrice(product.price);
        });

        setPriceInputs(prices);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);

        if (ativo) {
          toast.error("Não foi possível carregar os produtos.");
        }
      } finally {
        if (ativo) {
          setLoadingProducts(false);
        }
      }
    }

    fetchProducts();

    return () => {
      ativo = false;
    };
  }, [user?.id, refreshKey]);

  // Limpar URLs temporárias quando mudarem ou desmontar
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [previews]);

  const handleChange = (
    productId: string,
    field: keyof Product,
    value: string | number,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  };

  const handleImageChange = (productId: string, file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }

    setFilesToUpload((prev) => ({
      ...prev,
      [productId]: file,
    }));

    const url = URL.createObjectURL(file);

    setPreviews((prev) => ({
      ...prev,
      [productId]: url,
    }));
  };

  async function handleEditProduct(productId: string) {
    const productToUpdate = products.find(
      (product) => product.id === productId,
    );

    if (!productToUpdate) return;

    if (!lanchoneteProfile?.id) {
      toast.error("ID do restaurante não encontrado. Faça login novamente.");
      return;
    }

    const priceFloat = parsePrice(
      priceInputs[productId] ?? productToUpdate.price,
    );

    if (!Number.isFinite(priceFloat) || priceFloat <= 0) {
      toast.error("Informe um preço válido maior que zero.");
      return;
    }

    if (!productToUpdate.name.trim()) {
      toast.error("O nome do produto é obrigatório.");
      return;
    }

    if (!productToUpdate.description.trim()) {
      toast.error("A descrição do produto é obrigatória.");
      return;
    }

    setLoadingProductId(productId);

    try {
      const formData = new FormData();

      formData.append("product_id", productToUpdate.id);
      formData.append("name", productToUpdate.name.trim());
      formData.append("description", productToUpdate.description.trim());

      // Envia em reais: 15.00 -> "15"
      // ou 15.90 -> "15.9"
      formData.append("price", String(priceFloat));



      const newImageFile = filesToUpload[productId];

      if (newImageFile) {
        formData.append("file", newImageFile);
      }

      const res = await fetch("/api/product", {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(
          errorData.message ||
            `Falha ao atualizar o produto "${productToUpdate.name}".`,
        );
      }

      toast.success(
        `Produto "${productToUpdate.name}" atualizado com sucesso!`,
      );

      // Atualiza o valor exibido após salvar
      handleChange(productId, "price", priceFloat);

      setPriceInputs((prev) => ({
        ...prev,
        [productId]: formatPrice(priceFloat),
      }));

      // Busca novamente os dados atualizados no backend
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar o produto.",
      );
    } finally {
      setLoadingProductId(null);
    }
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()),
  );

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShoppingBag size={17} />
            <span>Gerenciamento de produtos</span>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Editar produtos
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Atualize informações, preços e imagens dos produtos do seu
                cardápio.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Package size={19} className="text-orange-500" />

              <span className="text-sm font-semibold text-slate-700">
                {products.length} produtos
              </span>
            </div>
          </div>
        </header>

        {/* BUSCA */}
        <div className="mb-7 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Buscar produto pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-12`}
            />
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            disabled={loadingProducts}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loadingProducts ? "animate-spin" : ""}
            />
            Atualizar lista
          </button>
        </div>

        {/* CARREGANDO */}
        {loadingProducts && (
          <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2 size={35} className="animate-spin text-orange-500" />

            <p className="mt-4 text-sm text-slate-500">
              Carregando produtos...
            </p>
          </div>
        )}

        {/* LISTA DE PRODUTOS */}
        {!loadingProducts && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {filteredProducts.map((product) => product.has_variants ? (
              <article key={product.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-900">{product.name}</h2>
                <Link className="text-sm font-semibold text-orange-700 hover:underline"
                  href={`/dashboard/product?draft=${encodeURIComponent(product.id)}`}>
                  Editar configuração
                </Link>
              </article>
            ) : (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* IMAGEM */}
                <div className="relative h-56 w-full overflow-hidden bg-slate-100 sm:h-64">
                  {previews[product.id] || product.image_url ? (
                    <Image
                      src={previews[product.id] || product.image_url}
                      alt={product.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <ImagePlus size={60} />
                    </div>
                  )}

                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <Pencil size={13} className="text-orange-500" />
                    Editar produto
                  </div>

                  {/* TROCAR IMAGEM */}
                  <label className="absolute bottom-4 right-4 flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-md transition hover:bg-orange-500 hover:text-white">
                    <Camera size={17} />
                    Trocar imagem
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handleImageChange(product.id, e.target.files?.[0]);
                      }}
                    />
                  </label>
                </div>

                {/* CAMPOS */}
                <div className="space-y-5 p-5 sm:p-6">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Nome do produto
                    </label>

                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) =>
                        handleChange(product.id, "name", e.target.value)
                      }
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Descrição
                    </label>

                    <textarea
                      rows={3}
                      value={product.description}
                      onChange={(e) =>
                        handleChange(product.id, "description", e.target.value)
                      }
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Preço de venda
                    </label>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-slate-500">
                        R$
                      </span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={priceInputs[product.id] ?? ""}
                        onChange={(e) => {
                          setPriceInputs((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }));
                        }}
                        onBlur={() => {
                          const price = parsePrice(
                            priceInputs[product.id] ?? "",
                          );

                          if (Number.isFinite(price) && price > 0) {
                            setPriceInputs((prev) => ({
                              ...prev,
                              [product.id]: formatPrice(price),
                            }));
                          }
                        }}
                        className={`${inputClass} pl-12`}
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-slate-400">
                      Exemplo: 15,90
                    </p>
                  </div>

                  {/* AÇÕES */}
                  <div className="border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => handleEditProduct(product.id)}
                      disabled={loadingProductId !== null}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingProductId === product.id ? (
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
                </div>
              </article>
            ))}
          </div>
        )}

        {/* LISTA VAZIA */}
        {!loadingProducts && filteredProducts.length === 0 && (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center">
            <Package size={44} className="text-slate-300" />

            <h2 className="mt-4 text-lg font-semibold text-slate-800">
              Nenhum produto encontrado
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {search
                ? "Tente buscar por outro nome."
                : "Ainda não há produtos cadastrados."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
