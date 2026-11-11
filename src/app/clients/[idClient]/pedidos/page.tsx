"use client";
import { chatCredentialKey } from "@/app/util/chatApi";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
  Banknote,
  Loader2,
  Pencil,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { CartProduct, LanchoneteProfile } from "@/app/models/interface";
import { formatarPreco } from "@/app/components/money";
import { type AddressData, type Bairro } from "./component";
import CustomerIdentification from "./component/CustomerIdentification";
import { currentCustomer, CustomerIdentificationError, type IdentifiedCustomer } from "@/app/util/customerIdentification";
import { customerOrderKey, watchCustomerSessionChanges } from "@/app/util/customerStorage";
import { cartLineKey, orderItems, refreshCartProducts, lerValorEmReais, readDeliveryFee, restoreCart } from "@/app/util/checkout";
import api from "@/app/util/api";

type PaymentMethod = "" | "Dinheiro" | "Cartao" | "Pix";

const CART_KEY = "product";
const QUANTITY_KEY = "product_quantities";

export default function Car() {
  const { idClient } = useParams<{ idClient: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const submitting = useRef(false);
  const [car, setCar] = useState<CartProduct[]>([]);
  const [count, setCount] = useState<Record<string, number>>({});
  const [active, setActive] = useState(false);
  const [address, setAddress] = useState<AddressData | null>(null);
  const [payments, setPayments] = useState<PaymentMethod>("");
  const [trocoPara, setTrocoPara] = useState("");
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [loadingBairros, setLoadingBairros] = useState(true);
  const [store, setStore] = useState<Partial<LanchoneteProfile>>({});
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [identifiedCustomer, setIdentifiedCustomer] = useState<IdentifiedCustomer | null>(null);
  const sessionVersion = useRef(0);
  const pendingKey = `pending_order:${idClient}`;

  useEffect(() => {
    if (!idClient) return;
    let ativo = true;

    async function carregar() {
      setLoading(true);
      setLoadingBairros(true);
      setBairros([]);
      setStore({});
      setAddress(null);
      setIdentifiedCustomer(null);
      try {
        const pending = Boolean(localStorage.getItem(pendingKey));
        if (ativo) setSubmissionUncertain(pending);
        const produtosSalvos = localStorage.getItem(CART_KEY);
        const quantidadesSalvas = localStorage.getItem(QUANTITY_KEY);
        const { products: produtos, counts } = restoreCart(produtosSalvos, quantidadesSalvas, idClient);
        if (ativo) {
          setCar(produtos);
          setCount(counts);
        }

        // Old contact/address values cannot be safely attributed to a person or restaurant.
        localStorage.removeItem("customerInfo");
        localStorage.removeItem("order");

        const resultados = await Promise.allSettled([
          fetch(`/api/store/${idClient}`, { signal: AbortSignal.timeout(15000) }).then(async (res) => {
            if (!res.ok) throw new Error(`Loja: HTTP ${res.status}`);
            return res.json() as Promise<LanchoneteProfile>;
          }),
          api.get<Bairro[]>(`/bairros/public/${idClient}`, { timeout: 15000 }),
        ]);
        if (!ativo) return;
        if (resultados[0].status === "fulfilled") setStore(resultados[0].value);
        else console.error("Erro ao carregar loja:", resultados[0].reason);
        if (resultados[1].status === "fulfilled") {
          setBairros(
            Array.isArray(resultados[1].value.data)
              ? resultados[1].value.data
              : [],
          );
        } else {
          console.error("Erro ao carregar bairros:", resultados[1].reason);
          toast.error("Não foi possível carregar os bairros de entrega.");
        }
      } catch (error) {
        console.error("Erro ao carregar carrinho:", error);
        toast.error("Erro ao carregar seu carrinho.");
      } finally {
        if (ativo) {
          setLoading(false);
          setLoadingBairros(false);
        }
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [idClient]);

  useEffect(() => {
    sessionVersion.current += 1;
    const unsubscribe = watchCustomerSessionChanges(idClient, () => {
      sessionVersion.current += 1;
      setIdentifiedCustomer(null);
      setAddress(null);
      setActive(false);
    });
    return () => {
      sessionVersion.current += 1;
      unsubscribe();
    };
  }, [idClient]);

  function atualizarCarrinho(
    produtos: CartProduct[],
    quantidades: Record<string, number>,
  ) {
    setCar(produtos);
    setCount(quantidades);
    localStorage.setItem(CART_KEY, JSON.stringify(produtos));
    localStorage.setItem(QUANTITY_KEY, JSON.stringify(quantidades));
  }

  function handleAdd(item: CartProduct) {
    if ((count[cartLineKey(item)] || 0) >= 32767) {
      toast.error("Quantidade máxima atingida.");
      return;
    }
    atualizarCarrinho(car, { ...count, [cartLineKey(item)]: (count[cartLineKey(item)] || 0) + 1 });
  }

  function handleSub(item: CartProduct) {
    const quantidade = count[cartLineKey(item)] || 0;
    if (quantidade <= 1) {
      removerProduto(cartLineKey(item));
      return;
    }
    atualizarCarrinho(car, { ...count, [cartLineKey(item)]: quantidade - 1 });
  }

  function removerProduto(productId: string) {
    const produtos = car.filter((item) => cartLineKey(item) !== productId);
    const quantidades = { ...count };
    delete quantidades[productId];
    atualizarCarrinho(produtos, quantidades);
  }

  const bairroSelecionado = useMemo(
    () =>
      bairros.find(
        (item) =>
          item.bairro.trim().toLocaleLowerCase("pt-BR") ===
          address?.bairro?.trim().toLocaleLowerCase("pt-BR"),
      ),
    [bairros, address],
  );

  // O código existente utiliza frete em reais, assim como os preços dos produtos.
  const frete = bairroSelecionado ? readDeliveryFee(bairroSelecionado.frete) : null;
  const freteValido = frete !== null && Number.isFinite(frete) && frete >= 0;
  const subtotal = car.reduce(
    (soma, item) => soma + Math.round(Number(item.price) * 100) * (count[cartLineKey(item)] || 0),
    0,
  ) / 100;
  const totalGeral = Math.round((subtotal + (freteValido ? frete : 0)) * 100) / 100;
  const totalItens = car.reduce(
    (soma, item) => soma + (count[cartLineKey(item)] || 0),
    0,
  );
  const valorTroco = lerValorEmReais(trocoPara);
  const podeFinalizar =
    car.length > 0 &&
    totalItens > 0 &&
    Number.isFinite(totalGeral) &&
    Boolean(address) && Boolean(identifiedCustomer) &&
    freteValido &&
    Boolean(payments) &&
    !finalizando && !submissionUncertain;

  function handleIdentified(data: AddressData, customer: IdentifiedCustomer) {
    sessionVersion.current += 1;
    setAddress(data);
    setIdentifiedCustomer(customer);
    setActive(false);
  }

  function handleCustomerLogout() {
    sessionVersion.current += 1;
    setAddress(null);
    setIdentifiedCustomer(null);
  }

  async function handleFinalizar() {
    if (submitting.current || submissionUncertain) return;
    if (!address || !identifiedCustomer || identifiedCustomer.restaurant_id !== idClient) {
      toast.error("Confirme sua identificação e o endereço de entrega.");
      setActive(true);
      return;
    }
    if (!freteValido) {
      toast.error("Selecione um bairro com taxa de entrega disponível.");
      setActive(true);
      return;
    }
    if (!payments) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    const itemsInCart = car.filter((item) => (count[cartLineKey(item)] || 0) > 0);
    if (!itemsInCart.length) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    if (
      payments === "Dinheiro" &&
      trocoPara.trim() &&
      (!Number.isFinite(valorTroco) || valorTroco < totalGeral)
    ) {
      toast.error(
        "O valor para troco deve ser igual ou maior que o total do pedido.",
      );
      return;
    }

    if (!Number.isFinite(totalGeral)) {
      toast.error("O valor do carrinho é inválido. Adicione os produtos novamente.");
      return;
    }
    submitting.current = true;
    setFinalizando(true);
    let requestSent = false;
    const confirmedVersion = sessionVersion.current;
    try {
      orderItems(itemsInCart, count);
      const refreshed = await refreshCartProducts(itemsInCart, idClient);
      const changed = refreshed.some((item, index) =>
        Math.round(Number(item.price) * 100) !== Math.round(Number(itemsInCart[index].price) * 100));
      atualizarCarrinho(refreshed, count);
      if (changed) {
        toast.error("Os preços foram atualizados. Confira o novo total e finalize novamente.");
        return;
      }

      const customer = await currentCustomer(idClient);
      if (!customer || customer.id !== identifiedCustomer.id || customer.name !== identifiedCustomer.name ||
          customer.phone !== identifiedCustomer.phone || sessionVersion.current !== confirmedVersion) {
        throw new CustomerIdentificationError("SESSION_CHANGED", "Confirme novamente quem está fazendo o pedido.");
      }

      localStorage.setItem(pendingKey, "pending");
      requestSent = true;
      const orderResponse = await fetch(`/api/orders/${encodeURIComponent(idClient)}`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Customer-Id": identifiedCustomer.id }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          bairro_id: bairroSelecionado?.id,
          items: orderItems(refreshed, count),
          payment_method: payments,
          change_for: payments === "Dinheiro" && trocoPara.trim() ? String(valorTroco) : "0",
        }),
      });
      const confirmed = await orderResponse.json();
      if (!orderResponse.ok) {
        if ([400, 401, 403, 404, 409, 422].includes(orderResponse.status)) {
          requestSent = false;
          localStorage.removeItem(pendingKey);
        }
        if ([401, 403].includes(orderResponse.status) || confirmed?.code === "SESSION_CHANGED") {
          throw new CustomerIdentificationError(confirmed?.code ?? "SESSION_INVALID", confirmed?.error || "Confirme sua identificação.");
        }
        throw new Error(confirmed?.error || "Não foi possível confirmar o pedido.");
      }
      const orderId: unknown = confirmed?.order?.id;
      if (typeof orderId !== "string" || !orderId) throw new Error("Pedido criado sem identificador.");
      const credential: unknown = confirmed?.chat_credential;
      if (sessionVersion.current === confirmedVersion) {
        if (typeof credential === "string") localStorage.setItem(chatCredentialKey(idClient), credential);
        localStorage.setItem(customerOrderKey(idClient), JSON.stringify(orderId));
      }
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(QUANTITY_KEY);
      localStorage.removeItem(pendingKey);
      setCar([]);
      setCount({});
      const changeMessage = payments === "Dinheiro" && Number(confirmed.change_due) > 0
        ? ` Troco: ${formatarPreco(confirmed.change_due)}.` : "";
      toast.success(`Pedido confirmado: ${formatarPreco(confirmed.order.total_price)}.${changeMessage}`);
      router.push(`/clients/${idClient}`);
    } catch (error) {
      console.error("Erro ao finalizar pedido:", error);
      if (requestSent) {
        setSubmissionUncertain(true);
        toast.error("Não foi possível confirmar a resposta. Confira com o restaurante se o pedido foi recebido antes de tentar novamente.");
      } else {
        if (error instanceof CustomerIdentificationError) {
          setIdentifiedCustomer(null);
          setAddress(null);
          setActive(true);
        }
        toast.error(error instanceof Error ? error.message : "Não foi possível finalizar o pedido. Tente novamente.");
      }
    } finally {
      submitting.current = requestSent;
      setFinalizando(false);
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-700">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p>Carregando seu carrinho...</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <Link
            href={`/clients/${idClient}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-orange-600"
          >
            <ArrowLeft size={19} /> Voltar ao cardápio
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <ShoppingBag size={19} className="text-orange-500" />{" "}
            {store.name || "Meu pedido"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7">
          <p className="text-sm font-semibold text-orange-600">Quase lá!</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Meu carrinho
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Confira seus produtos, escolha a entrega e finalize seu pedido.
          </p>
        </div>

        {submissionUncertain && (
          <div role="alert" className="mb-5 space-y-3 rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
            <p>A resposta do último pedido ficou pendente. Confira com o restaurante se ele foi recebido antes de fazer uma nova tentativa.</p>
            <button type="button" disabled={finalizando} className="font-semibold underline" onClick={() => {
              if (!window.confirm("Você confirmou com o restaurante que o pedido não foi recebido?")) return;
              localStorage.removeItem(pendingKey);
              submitting.current = false;
              setSubmissionUncertain(false);
            }}>Confirmei que o pedido não foi recebido</button>
          </div>
        )}

        {car.length === 0 ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <PackageOpen size={54} className="mx-auto text-slate-300" />
            <h2 className="mt-5 text-xl font-bold">Seu carrinho está vazio</h2>
            <p className="mt-2 text-sm text-slate-500">
              Escolha alguns produtos deliciosos para continuar.
            </p>
            <Link
              href={`/clients/${idClient}`}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
            >
              <ArrowLeft size={18} /> Explorar cardápio
            </Link>
          </section>
        ) : (
          <fieldset disabled={finalizando} className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <ShoppingBag size={21} className="text-orange-500" /> Seus
                    produtos
                  </h2>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    {totalItens} {totalItens === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {car.map((item) => (
                    <article
                      key={cartLineKey(item)}
                      className="flex gap-3 p-4 sm:gap-5 sm:p-5"
                    >
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ShoppingBag size={30} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {item.name}
                            </h3>
                            {item.variant_id && (
                              <div className="mt-1 text-xs text-slate-600">
                                <p>Tamanho: {item.variant_name || "Selecionado"}</p>
                                {Array.isArray(item.options) && item.options.map((option) => (
                                  <p key={option.id}>{option.group_name}: {option.name}</p>
                                ))}
                              </div>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              {item.variant_id ? "Unitário estimado" : "Unitário"}: {formatarPreco(item.price)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removerProduto(cartLineKey(item))}
                            aria-label={`Remover ${item.name}`}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex h-10 items-center overflow-hidden rounded-xl border border-orange-200 bg-orange-50">
                            <button
                              type="button"
                              onClick={() => handleSub(item)}
                              className="flex h-full w-10 items-center justify-center text-orange-600 hover:bg-orange-100"
                              aria-label={`Diminuir ${item.name}`}
                            >
                              <Minus size={17} />
                            </button>
                            <span className="min-w-7 text-center text-sm font-bold">
                              {count[cartLineKey(item)] || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdd(item)}
                              className="flex h-full w-10 items-center justify-center text-orange-600 hover:bg-orange-100"
                              aria-label={`Aumentar ${item.name}`}
                            >
                              <Plus size={17} />
                            </button>
                          </div>
                          <p className="font-bold text-orange-600">
                            {formatarPreco(
                              Number(item.price) * (count[cartLineKey(item)] || 0),
                            )}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <Link
                    href={`/clients/${idClient}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
                  >
                    <Plus size={17} /> Adicionar mais produtos
                  </Link>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <MapPin size={21} className="text-orange-500" /> Identificação e
                    entrega
                  </h2>
                  {address && (
                    <button
                      type="button"
                      onClick={() => setActive(true)}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      <Pencil size={15} /> Alterar
                    </button>
                  )}
                </div>
                {address ? (
                  <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
                    <p className="font-semibold text-slate-800">
                      {address.name}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {address.rua}, {address.numero} — {address.bairro},{" "}
                      {address.cidade}
                    </p>
                    {address.complemento && (
                      <p className="text-sm text-slate-500">
                        {address.complemento}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Telefone: {address.phone}
                    </p>
                    {!freteValido && (
                      <p className="mt-3 text-sm font-medium text-red-600">
                        O bairro salvo não está disponível. Altere o endereço
                        para continuar.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <MapPin size={27} className="mx-auto text-slate-400" />
                    <p className="mt-2 text-sm text-slate-500">
                      Confirme sua identificação e o endereço de entrega.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActive(true)}
                      className="mt-4 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                    >
                      Identificar e informar entrega
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Wallet size={21} className="text-orange-500" /> Forma de
                  pagamento
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      { value: "Pix", label: "Pix", Icon: CheckCircle2 },
                      { value: "Cartao", label: "Cartão", Icon: CreditCard },
                      { value: "Dinheiro", label: "Dinheiro", Icon: Banknote },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setPayments(value);
                        setTrocoPara("");
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-4 text-sm font-semibold transition ${payments === value ? "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-100" : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"}`}
                    >
                      <Icon size={19} /> {label}
                    </button>
                  ))}
                </div>
                {payments === "Dinheiro" && (
                  <div className="mt-4">
                    <label
                      htmlFor="troco"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Troco para quanto? (opcional)
                    </label>
                    <input
                      id="troco"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 50,00"
                      value={trocoPara}
                      onChange={(event) => setTrocoPara(event.target.value)}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Deixe vazio se não precisar de troco.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold">Resumo do pedido</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>
                      Subtotal ({totalItens}{" "}
                      {totalItens === 1 ? "item" : "itens"})
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatarPreco(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <Truck size={17} /> Taxa de entrega
                    </span>
                    <span
                      className={`font-semibold ${freteValido && frete === 0 ? "text-green-600" : "text-slate-800"}`}
                    >
                      {!address
                        ? "Informe o bairro"
                        : !freteValido
                          ? "Indisponível"
                          : frete === 0
                            ? "Grátis"
                            : formatarPreco(frete)}
                    </span>
                  </div>
                  {bairroSelecionado && (
                    <p className="text-xs text-slate-500">
                      Entrega para {bairroSelecionado.bairro}
                    </p>
                  )}
                </div>
                <div className="my-5 border-t border-dashed border-slate-200" />
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-extrabold text-orange-600">
                    {freteValido ? formatarPreco(totalGeral) : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!podeFinalizar}
                  onClick={handleFinalizar}
                  className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-bold text-white shadow-lg shadow-orange-500/15 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {finalizando ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />{" "}
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> Finalizar pedido
                    </>
                  )}
                </button>
                {!address && (
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Adicione o endereço para continuar.
                  </p>
                )}
                {address && !payments && (
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Escolha a forma de pagamento para continuar.
                  </p>
                )}
                <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
                  <ShieldCheck size={15} /> Confira seus dados antes de
                  confirmar
                </p>
              </section>
            </aside>
          </fieldset>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm"
        >
          <CustomerIdentification
            key={idClient}
            restaurantId={idClient}
            onIdentified={handleIdentified}
            onLogout={handleCustomerLogout}
            onClose={() => setActive(false)}
            initialData={address}
            initialCustomerId={identifiedCustomer?.id}
            bairros={bairros}
            loadingBairros={loadingBairros}
          />
        </div>
      )}
    </main>
  );
}
