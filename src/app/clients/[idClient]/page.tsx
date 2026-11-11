"use client";
import chatApi from "@/app/util/chatApi";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { formatarPreco } from "@/app/components/money";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircleMore,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  XCircle,
} from "lucide-react";

import { Product, CartProduct, LanchoneteProfile } from "@/app/models/interface";
import { formatReal } from "@/app/money";
import api from "@/app/util/api";
import socket from "@/app/components/Socket";
import { customerOrderKey, watchCustomerSessionChanges } from "@/app/util/customerStorage";
import ProductConfigurationDialog from "./ProductConfigurationDialog";
import { cartLineKey, restoreCart } from "@/app/util/checkout";
import { joinChat, leaveChat } from "@/app/util/chatRooms";

interface Message {
  id: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
}

type CartItem = CartProduct & {
  quantity: number;
};

const CART_KEY = "product";
const QUANTITY_KEY = "product_quantities";

export default function Client() {
  const params = useParams();
  const idClient = params.idClient as string;

  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<Product | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [store, setStore] = useState<LanchoneteProfile>({
    id: "",
    name: "",
    email: "",
    phone: "",
    city: "",
    neighborhood: "",
    street: "",
    number: "",
    status: true,
    image_url: "",
  });

  const cartUrl = `/clients/${idClient}/pedidos`;
  const chatUrl = `/clients/${idClient}/pedidos/component/chatClient`;

  // Salva no formato que a página do carrinho já utiliza.
  const saveCart = useCallback((items: CartItem[]) => {
    setCart(items);

    const products = items.map(({ quantity, ...product }) => product);

    const quantities = Object.fromEntries(
      items.map((item) => [cartLineKey(item), item.quantity]),
    );

    localStorage.setItem(CART_KEY, JSON.stringify(products));
    localStorage.setItem(QUANTITY_KEY, JSON.stringify(quantities));
  }, []);

  // Recupera o carrinho salvo.
  useEffect(() => {
    try {
      const storedProducts = localStorage.getItem(CART_KEY);
      const storedQuantities = localStorage.getItem(QUANTITY_KEY);

      const { products, counts } = restoreCart(storedProducts, storedQuantities, idClient);
      const restoredCart: CartItem[] = products.map((product) => ({
        ...product, quantity: counts[cartLineKey(product)],
      }));

      setCart(restoredCart);
    } catch (error) {
      console.error("Erro ao recuperar carrinho:", error);
      setCart([]);
    }
  }, [idClient]);

  // Carrega loja e produtos.
  useEffect(() => {
    if (!idClient) return;

    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);

      try {
        const [storeResponse, productsResponse] = await Promise.all([
          fetch(`/api/store/${idClient}`),
          fetch(`/api/products/${idClient}`),
        ]);

        if (!storeResponse.ok || !productsResponse.ok) {
          throw new Error("Erro ao carregar dados da loja.");
        }

        const storeData: LanchoneteProfile = await storeResponse.json();

        const productsData: Product[] = await productsResponse.json();

        if (cancelled) return;

        setStore(storeData);
        setProdutos(productsData);
        setIsOpen(Boolean(storeData.status));
      } catch (error) {
        console.error("Erro ao carregar loja:", error);

        if (!cancelled) {
          toast.error("Não foi possível carregar o cardápio.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [idClient]);

  // Atualização do status da loja via Socket.IO.
  useEffect(() => {
    function handleStatusUpdate(data: { status: boolean }) {
      setIsOpen(data.status);
    }

    socket.on("statusUpdated", handleStatusUpdate);

    return () => {
      socket.off("statusUpdated", handleStatusUpdate);
    };
  }, []);

  useEffect(() => watchCustomerSessionChanges(idClient, () => {
    socket.disconnect();
    window.location.reload();
  }), [idClient]);

  // Busca o chat associado ao pedido anterior.
  useEffect(() => {
    if (!idClient) return;

    const savedOrder = localStorage.getItem(customerOrderKey(idClient));

    if (!savedOrder) return;

    let cancelled = false;

    async function loadChat(savedOrder: string) {
      try {
        let orderId = savedOrder;

        try {
          const parsed = JSON.parse(savedOrder);

          if (typeof parsed === "string") {
            orderId = parsed;
          }
        } catch {
          orderId = savedOrder.replace(/^"|"$/g, "");
        }

        const response = await chatApi.get(`/chat/${orderId}`);

        if (!cancelled && response.data?.chat_id) {
          setChatId(response.data.chat_id);
        }
      } catch (error) {
        console.error("Erro ao carregar chat:", error);
      }
    }

    void loadChat(savedOrder);

    return () => {
      cancelled = true;
    };
  }, [idClient]);

  // Busca mensagens existentes.
  useEffect(() => {
    if (!chatId) return;

    let cancelled = false;

    async function loadMessages() {
      try {
        const response = await chatApi.get<Message[]>(`/message/${chatId}`);

        if (!cancelled) {
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Atualiza as mensagens do chat em tempo real.
  useEffect(() => {
    if (!chatId) return;

    function joinRoom() {
      if (chatId) joinChat(socket, chatId);
    }

    function handleNewMessage(message: Message) {
      if (message.chat_id !== chatId) return;

      setMessages((previous) => {
        if (previous.some((item) => item.id === message.id)) {
          return previous;
        }

        return [...previous, message];
      });
    }

    joinRoom();

    socket.on("connect", joinRoom);
    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("newMessage", handleNewMessage);
      leaveChat(socket, chatId);
    };
  }, [chatId]);

  // Adiciona uma unidade do produto.
  function addProduct(product: Product) {
    if (product.has_variants) {
      setConfiguring(product);
      return;
    }
    try { addCartProduct(product); } catch (error) { toast.error((error as Error).message); }
  }

  function addCartProduct(product: CartProduct) {
    if (!isOpen) {
      toast.info("A lanchonete está fechada no momento.");
      throw new Error("A lanchonete está fechada no momento.");
    }

    const key = cartLineKey(product);
    const existing = cart.find((item) => cartLineKey(item) === key);
    if (existing && existing.quantity >= 32767) {
      throw new Error("Quantidade máxima atingida.");
    }

    if (existing) {
      saveCart(
        cart.map((item) =>
          cartLineKey(item) === key
            ? { ...product, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      saveCart([...cart, { ...product, quantity: 1 }]);
    }

    toast.success(`${product.name} adicionado ao carrinho!`, {
      autoClose: 1200,
    });
  }

  // Diminui a quantidade e remove quando chega a zero.
  function removeProduct(productId: string) {
    const updatedCart = cart
      .map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
      )
      .filter((item) => item.quantity > 0);

    saveCart(updatedCart);
  }

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return produtos;

    return produtos.filter((product) =>
      `${product.name} ${product.description ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [produtos, search]);

  const cartQuantity = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + Number(item.price) * item.quantity,
        0,
      ),
    [cart],
  );

  const restaurantMessages = messages.filter(
    (message) => message.sender_type === "restaurant",
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />

        <p className="mt-4 text-sm font-medium text-slate-500">
          Carregando cardápio...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32 text-slate-900">
      {/* CAPA DA LOJA */}
      <div className="relative h-40 overflow-hidden bg-slate-900 sm:h-52">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{
            backgroundImage: "url('/ProjetoLanches.png')",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />

        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-6xl items-center justify-between p-4">
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
            Cardápio digital
          </span>

          <Link
            href={cartUrl}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900 shadow-lg transition hover:bg-orange-50"
            aria-label="Abrir carrinho"
          >
            <ShoppingCart size={21} />

            {cartQuantity > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white">
                {cartQuantity}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* INFORMAÇÕES DA LOJA */}
        <section className="relative -mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-orange-50 shadow-md">
              {store.image_url ? (
                <img
                  src={store.image_url}
                  alt={`Logo da ${store.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store size={35} className="text-orange-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {store.name}
              </h1>

              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={16} className="shrink-0" />
                {[store.street, store.number, store.neighborhood, store.city]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>

            <div
              className={`flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                isOpen ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}
            >
              {isOpen ? <CheckCircle2 size={17} /> : <XCircle size={17} />}

              {isOpen ? "Aberto para pedidos" : "Fechado"}
            </div>
          </div>

          {/* INFORMAÇÕES DE ENTREGA */}
          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <Truck size={21} />
              </div>

              <div>
                <p className="text-sm font-semibold">Entrega por bairro</p>

                <p className="text-xs text-slate-500">
                  Frete calculado no carrinho
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <Clock3 size={21} />
              </div>

              <div>
                <p className="text-sm font-semibold">Faça seu pedido online</p>

                <p className="text-xs text-slate-500">
                  Escolha seus produtos e finalize
                </p>
              </div>
            </div>
          </div>

          {/* ACESSO AO CHAT */}
          {chatId && (
            <Link
              href={chatUrl}
              className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 transition hover:bg-orange-100"
            >
              <div className="flex min-w-0 items-center gap-3">
                <MessageCircleMore
                  size={23}
                  className="shrink-0 text-orange-600"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Conversar com a lanchonete
                  </p>

                  <p className="text-xs text-slate-500">
                    {restaurantMessages.length > 0
                      ? `${restaurantMessages.length} mensagens da lanchonete`
                      : "Acompanhe seu pedido pelo chat"}
                  </p>
                </div>
              </div>

              <ArrowRight size={19} className="shrink-0 text-orange-600" />
            </Link>
          )}
        </section>

        {/* TÍTULO E PESQUISA */}
        <section className="mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-orange-600">
                Nosso cardápio
              </p>

              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                Escolha seus favoritos
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Adicione os produtos que desejar ao carrinho.
              </p>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no cardápio..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </div>

          {/* LISTA DE PRODUTOS */}
          {!isOpen ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <XCircle size={44} className="text-slate-300" />

              <h3 className="mt-4 text-lg font-bold">
                Estamos fechados no momento
              </h3>

              <p className="mt-2 max-w-sm text-sm text-slate-500">
                O cardápio estará disponível para novos pedidos quando a
                lanchonete abrir.
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <Search size={36} className="mx-auto text-slate-300" />

              <h3 className="mt-4 font-semibold">Nenhum produto encontrado</h3>

              <p className="mt-2 text-sm text-slate-500">
                Tente pesquisar por outro nome.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredProducts.map((product) => {
                const cartItem = cart.find((item) => item.id === product.id);

                const quantity = cartItem?.quantity ?? 0;

                return (
                  <article
                    key={product.id}
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-orange-200 hover:shadow-md sm:p-4"
                  >
                    {/* IMAGEM */}
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:h-36 sm:w-36">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag size={34} className="text-slate-300" />
                      )}
                    </div>

                    {/* DETALHES */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-2 text-sm font-bold text-slate-900 sm:text-base">
                        {product.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">
                        {product.description}
                      </p>

                      <div className="mt-auto pt-3">
                        <p className="mb-3 text-base font-bold text-orange-600 sm:text-lg">
                          {product.has_variants && "A partir de "}{formatarPreco(product.price)}
                        </p>

                        {product.has_variants ? (
                          <button type="button" onClick={() => addProduct(product)}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white hover:bg-orange-600">
                            Escolher tamanho e opções
                          </button>
                        ) : quantity === 0 ? (
                          <button
                            type="button"
                            onClick={() => addProduct(product)}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                          >
                            <Plus size={17} />
                            Adicionar
                          </button>
                        ) : (
                          <div className="flex h-10 items-center justify-between rounded-xl border border-orange-200 bg-orange-50">
                            <button
                              type="button"
                              onClick={() => removeProduct(product.id)}
                              className="flex h-full w-11 items-center justify-center text-orange-600 hover:bg-orange-100"
                              aria-label={`Diminuir ${product.name}`}
                            >
                              <Minus size={19} />
                            </button>

                            <span className="font-bold text-slate-800">
                              {quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => addProduct(product)}
                              className="flex h-full w-11 items-center justify-center text-orange-600 hover:bg-orange-100"
                              aria-label={`Adicionar ${product.name}`}
                            >
                              <Plus size={19} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {configuring && (
        <ProductConfigurationDialog key={configuring.id} product={configuring} restaurantId={idClient}
          onClose={() => setConfiguring(null)} onAdd={addCartProduct} />
      )}

      {/* CARRINHO FIXO */}
      {cartQuantity > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-4">
          <div className="mx-auto max-w-6xl">
            <Link
              href={cartUrl}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-orange-500 px-4 py-3 text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 sm:px-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative">
                  <ShoppingBag size={24} />

                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-orange-600">
                    {cartQuantity}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold sm:text-base">
                    Ver meu carrinho
                  </p>

                  <p className="text-xs text-orange-100">
                    {cartQuantity}{" "}
                    {cartQuantity === 1
                      ? "item selecionado"
                      : "itens selecionados"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold sm:text-lg">
                  {formatarPreco(cartSubtotal)}
                </span>

                <ArrowRight size={20} />
              </div>
            </Link>

            <p className="mt-2 text-center text-[11px] text-slate-400">
              Subtotal dos produtos • Frete calculado no checkout
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
