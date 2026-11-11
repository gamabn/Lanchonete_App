"use client";
import chatApi from "@/app/util/chatApi";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";

import { toast } from "react-toastify";
import { format, isValid } from "date-fns";

import { Context } from "@/app/Context";
import { LanchoneteProfile, VendasProps } from "@/app/models/interface";

import { Delete } from "../../Delete";
import { ShareButton } from "../shareButton";
import ordersAdminApi from "@/app/util/ordersAdminApi";
//import { subscribeOrders } from "@/app/util/ordersSocket";
import {
  subscribeOrders,
  type OrderStatusUpdate,
} from "@/app/util/ordersSocket";
import { useRouter } from "next/navigation";
// Valores da API em reais
function formatCurrency(value: number | string): string {
  const number = Number(value);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value: string | Date): string {
  const date = new Date(value);

  if (!isValid(date)) {
    return "Data não disponível";
  }

  return format(date, "dd/MM/yyyy 'às' HH:mm");
}

// Gera o texto do comprovante
function formatSales(
  pedido: VendasProps,
  lanchoneteProfile: LanchoneteProfile | null,
) {
  let text = "COMPROVANTE DE VENDA\n";

  if (lanchoneteProfile?.name) {
    text += `Lanchonete: ${lanchoneteProfile.name}\n`;
  }

  text += "----------------------------------------\n";
  text += `Pedido: ${pedido.order_id}\n`;
  text += `Data: ${formatDate(pedido.created_at)}\n`;
  text += `Cliente: ${pedido.customer.name}\n`;
  text += `Telefone: ${pedido.customer.phone}\n`;

  text += `Endereço: ${pedido.customer.street}, ${pedido.customer.number}\n`;
  text += `Bairro: ${pedido.customer.neighborhood}\n`;
  text += `Cidade: ${pedido.customer.city}\n`;

  if (pedido.customer.complement) {
    text += `Complemento: ${pedido.customer.complement}\n`;
  }

  text += "----------------------------------------\n";
  text += "PRODUTOS\n\n";

  pedido.items.forEach((item) => {
    text += `${item.product_name}\n`;

    // Tamanho ou variante selecionada
    if (item.variant_name) {
      text += `Tamanho: ${item.variant_name}\n`;
    }

    text += `Qtd: ${item.quantity}\n`;

    // Ingredientes e adicionais
    if (item.options?.length) {
      text += "INGREDIENTES:\n";

      item.options.forEach((opcao) => {
        text += `  ${opcao.group_name}: ${opcao.option_name}`;

        if (Number(opcao.additional_price) > 0) {
          text += ` (+${formatCurrency(opcao.additional_price)})`;
        }

        text += "\n";
      });
    }

    text += `Unitário: ${formatCurrency(item.item_price)}\n`;

    text += `Subtotal: ${formatCurrency(
      Number(item.quantity) * Number(item.item_price),
    )}\n\n`;
  });

  //=====================================================
  /* pedido.items.forEach((item) => {
    text += `${item.product_name}\n`;
    text += `Qtd: ${item.quantity}\n`;
    text += `Unitário: ${formatCurrency(item.item_price)}\n`;
    text += `Subtotal: ${formatCurrency(
      Number(item.quantity) * Number(item.item_price),
    )}\n\n`;
  });  */
  //============================================================
  text += "----------------------------------------\n";
  text += `TOTAL: ${formatCurrency(pedido.total_price)}\n`;
  text += `Pagamento: ${pedido.payment_method || "Não informado"}\n`;

  if (Number(pedido.change_for) > 0) {
    text += `Troco para: ${formatCurrency(Number(pedido.change_for))}\n`;
  }

  text += "\nObrigado pela preferência!\n";

  return text;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const element = document.createElement("a");

  element.href = url;
  element.download = fileName;

  document.body.appendChild(element);
  element.click();
  element.remove();

  // Libera a URL após iniciar o download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Home({ data }: { data: VendasProps[] }) {
  const { lanchoneteProfile, ChatId, messages } = useContext(Context);

  const router = useRouter();

  const [orders, setOrders] = useState<VendasProps[]>(data);
  const [deleteModalOrderId, setDeleteModalOrderId] = useState<string | null>(
    null,
  );

  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "enviado">("all");

  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const loadingChatOrders = useRef<Set<string>>(new Set());

  const loadedChatOrders = useRef<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const soundEnabledRef = useRef(false);

  const recentStatusUpdates = useRef<Map<string, OrderStatusUpdate>>(new Map());

  const recentNewOrders = useRef<Map<string, VendasProps>>(new Map());
  // Sincroniza quando a prop data mudar
  useEffect(() => {
    const serverOrders = new Map(data.map((order) => [order.order_id, order]));

    // Preserva pedidos recebidos pelo Socket.IO
    for (const [id, order] of recentNewOrders.current) {
      if (serverOrders.has(id)) {
        // O backend já conhece esse pedido.
        recentNewOrders.current.delete(id);
      } else {
        serverOrders.set(id, order);
      }
    }

    // Aplica atualizações de status recentes
    for (const [id, update] of recentStatusUpdates.current) {
      const order = serverOrders.get(id);

      if (update.status === "completed") {
        serverOrders.delete(id);
      } else if (order) {
        serverOrders.set(id, {
          ...order,
          status: update.status,
        });
      }

      // Descarta a proteção quando o backend confirma o status
      if (
        data.some(
          (item) => item.order_id === id && item.status === update.status,
        )
      ) {
        if (update.status === "completed") {
          recentNewOrders.current.delete(id);
        }

        recentStatusUpdates.current.delete(id);
      }
    }

    setOrders(Array.from(serverOrders.values()));
  }, [data]);
  // Pedidos ativos
  const activeOrders = useMemo(() => {
    return orders.filter(
      (order) => order.status === "pending" || order.status === "enviado",
    );
  }, [orders]);

  const pendingCount = activeOrders.filter(
    (order) => order.status === "pending",
  ).length;

  const sentCount = activeOrders.filter(
    (order) => order.status === "enviado",
  ).length;

  const activeRevenue = activeOrders.reduce(
    (sum, order) => sum + (Number(order.total_price) || 0),
    0,
  );

  // Som de novo pedido
  const playSound = useCallback(async () => {
    if (!soundEnabledRef.current || !audioRef.current) return;

    try {
      const audio = audioRef.current;

      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn("Não foi possível reproduzir o som:", error);

      soundEnabledRef.current = false;
      setSoundEnabled(false);
    }
  }, []);

  const activateSound = async () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/audio/uber.mp3");
      }

      const audio = audioRef.current;

      audio.currentTime = 0;

      await audio.play();

      audio.pause();
      audio.currentTime = 0;

      soundEnabledRef.current = true;
      setSoundEnabled(true);

      console.log("🔔 Som de novos pedidos ativado!");
    } catch (error) {
      console.error("Erro ao ativar som:", error);

      soundEnabledRef.current = false;
      setSoundEnabled(false);
    }
  };

  const handleOrderUpdated = useCallback((update: OrderStatusUpdate) => {
    console.log("🔄 Atualizando pedido:", update);

    // Guarda a atualização recebida pelo Socket.IO
    recentStatusUpdates.current.set(update.order_id, update);

    setOrders((previous) => {
      if (update.status === "completed") {
        return previous.filter((order) => order.order_id !== update.order_id);
      }

      return previous.map((order) =>
        order.order_id === update.order_id
          ? { ...order, status: update.status }
          : order,
      );
    });
  }, []);

  const syncOrders = useCallback(() => {
    console.log("🔄 Sincronizando pedidos com o backend...");

    router.refresh();
  }, [router]);

  // Socket.IO
  useEffect(() => {
    function onNewOrder(newOrder: VendasProps) {
      recentNewOrders.current.set(newOrder.order_id, newOrder);

      console.log("📦 NOVO PEDIDO RECEBIDO VIA SOCKET:", newOrder);

      console.log("🍔 ITENS RECEBIDOS:", newOrder.items);

      newOrder.items?.forEach((item) => {
        console.log("Produto:", item.product_name);
        console.log("Tamanho:", item.variant_name);
        console.log("Ingredientes:", item.options);
        console.log("Preço:", item.item_price);
      });

      setOrders((previous) => {
        const exists = previous.some(
          (order) => order.order_id === newOrder.order_id,
        );

        if (exists) {
          return previous.map((order) =>
            order.order_id === newOrder.order_id ? newOrder : order,
          );
        }

        return [newOrder, ...previous];
      });

      playSound();
    }

    if (!lanchoneteProfile?.id) return;
    return subscribeOrders(
      lanchoneteProfile.id,
      onNewOrder,
      handleOrderUpdated,
      syncOrders,
    );
  }, [playSound, lanchoneteProfile?.id, handleOrderUpdated, syncOrders]);

  // Carrega as mensagens dos pedidos ativos
  useEffect(() => {
    let cancelled = false;

    const ordersToLoad = activeOrders.filter(
      (order) =>
        order.order_id &&
        !loadedChatOrders.current.has(order.order_id) &&
        !loadingChatOrders.current.has(order.order_id),
    );

    if (ordersToLoad.length === 0) {
      return;
    }

    ordersToLoad.forEach((order) => {
      loadingChatOrders.current.add(order.order_id);
    });

    async function loadMessages() {
      setMessagesLoaded(false);

      try {
        await Promise.all(
          ordersToLoad.map(async (order) => {
            const orderId = order.order_id;

            try {
              const success = await ChatId(orderId);

              if (success) {
                loadedChatOrders.current.add(orderId);
              }
            } finally {
              loadingChatOrders.current.delete(orderId);
            }
          }),
        );
      } catch (error) {
        console.error("Erro ao carregar chats:", error);
      } finally {
        if (!cancelled) {
          setMessagesLoaded(true);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeOrders, ChatId]);

  // Atualiza status do pedido
  async function handleFinalizar(orderId: string, status: string) {
    if (!orderId || loadingOrderId) return;

    setLoadingOrderId(orderId);

    try {
      if (status === "pending") {
        await ordersAdminApi.patch("", {
          id: orderId,
          status: "enviado",
        });

        /* setOrders((previous) =>
          previous.map((order) =>
            order.order_id === orderId
              ? { ...order, status: "enviado" }
              : order,
          ),
        ); */

        handleOrderUpdated({
          order_id: orderId,
          status: "enviado",
        });

        toast.success("Pedido enviado com sucesso!");
      } else {
        await chatApi.delete(`/chat/${orderId}`);

        await ordersAdminApi.patch("", {
          id: orderId,
          status: "completed",
        });

        handleOrderUpdated({
          order_id: orderId,
          status: "completed",
        });
        //=====================================
        /*  setOrders((previous) =>
          previous.filter((order) => order.order_id !== orderId),
        ); */
        //======================================
        toast.success("Pedido finalizado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);

      toast.error("Não foi possível atualizar o pedido.");
    } finally {
      setLoadingOrderId(null);
    }
  }

  // Busca e filtro
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return activeOrders
      .filter((order) => {
        if (filter === "all") return true;

        return order.status === filter;
      })
      .filter((order) => {
        if (!term) return true;

        return (
          order.customer.name.toLowerCase().includes(term) ||
          String(order.order_id).toLowerCase().includes(term) ||
          String(order.customer.phone).includes(term)
        );
      });
  }, [activeOrders, search, filter]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* MODAL DE EXCLUSÃO */}
        {deleteModalOrderId && (
          <Delete
            id={deleteModalOrderId}
            onClose={() => {
              setDeleteModalOrderId(null);
            }}
          />
        )}

        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShoppingBag size={17} />
            <span>Gerenciamento de pedidos</span>
            <button
              type="button"
              onClick={activateSound}
              disabled={soundEnabled}
              className={`rounded-lg px-4 py-2 font-semibold text-white ${
                soundEnabled
                  ? "bg-green-600"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {soundEnabled ? "🔔 Som ativado" : "🔕 Ativar som"}
            </button>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                <Truck size={30} className="text-orange-500" />
                Pedidos para entrega
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Acompanhe e gerencie os pedidos recebidos pela sua lanchonete.
              </p>
            </div>

            <div className="self-start">
              <ShareButton
                title="Cardápio da lanchonete"
                url={`http://localhost:3000/clients/${lanchoneteProfile?.id}`}
              />
            </div>
          </div>
        </header>

        {/* INDICADORES */}
        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Package size={22} />
            </div>

            <p className="mt-4 text-sm text-slate-500">Pedidos ativos</p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {activeOrders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock3 size={22} />
            </div>

            <p className="mt-4 text-sm text-slate-500">Aguardando envio</p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Truck size={22} />
            </div>

            <p className="mt-4 text-sm text-slate-500">Enviados</p>

            <p className="mt-1 text-3xl font-bold text-slate-900">
              {sentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Wallet size={22} />
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Valor dos pedidos ativos
            </p>

            <p className="mt-1 break-words text-2xl font-bold text-slate-900">
              {formatCurrency(activeRevenue)}
            </p>
          </div>
        </section>

        {/* FILTROS */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "all",
                  label: "Todos",
                  count: activeOrders.length,
                },
                {
                  id: "pending",
                  label: "Pendentes",
                  count: pendingCount,
                },
                {
                  id: "enviado",
                  label: "Enviados",
                  count: sentCount,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setFilter(item.id as "all" | "pending" | "enviado")
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === item.id
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou pedido..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </div>
        </section>

        {/* LISTA DE PEDIDOS */}
        {filteredOrders.length > 0 ? (
          <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredOrders.map((pedido) => {
              const isPending = pedido.status === "pending";

              const isLoading = loadingOrderId === pedido.order_id;

              const messageCount = messages.filter(
                (message) => message.order_id === pedido.order_id,
              ).length;

              return (
                <article
                  key={pedido.order_id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* CABEÇALHO DO PEDIDO */}
                  <div className="border-b border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                          <ShoppingBag size={22} />
                        </div>

                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-slate-900">
                            {pedido.customer.name}
                          </h2>

                          <p className="mt-1 text-xs text-slate-500">
                            Pedido #{String(pedido.order_id).slice(0, 8)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                          isPending
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isPending ? "Pendente" : "Enviado"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays size={15} />
                      {formatDate(pedido.created_at)}
                    </div>
                  </div>

                  {/* DADOS DO CLIENTE */}
                  <div className="space-y-3 border-b border-slate-100 p-5">
                    <div className="flex items-start gap-3">
                      <Phone
                        size={17}
                        className="mt-0.5 shrink-0 text-orange-500"
                      />

                      <p className="text-sm text-slate-700">
                        {pedido.customer.phone}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin
                        size={17}
                        className="mt-0.5 shrink-0 text-orange-500"
                      />

                      <div className="text-sm leading-6 text-slate-700">
                        <p>
                          {pedido.customer.street}, {pedido.customer.number}
                        </p>

                        <p>
                          {pedido.customer.neighborhood}
                          {" - "}
                          {pedido.customer.city}
                        </p>

                        {pedido.customer.complement && (
                          <p className="text-slate-500">
                            {pedido.customer.complement}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MessageCircle size={17} className="text-orange-500" />

                      <span className="text-sm text-slate-600">
                        Mensagens:{" "}
                        <strong>{messagesLoaded ? messageCount : "..."}</strong>
                      </span>
                    </div>
                  </div>

                  {/* ITENS */}
                  <div className="border-b border-slate-100 p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Package size={17} className="text-orange-500" />
                      Itens do pedido
                    </h3>

                    <div className="space-y-4">
                      {pedido.items.map((produto) => (
                        <div
                          key={produto.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-orange-100 px-2 text-xs font-bold text-orange-700">
                                {produto.quantity}x
                              </span>

                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">
                                  {produto.product_name}
                                </p>

                                {produto.variant_name && (
                                  <p className="mt-1 text-xs font-medium text-orange-600">
                                    Tamanho: {produto.variant_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className="shrink-0 text-sm font-semibold text-slate-800">
                              {formatCurrency(
                                Number(produto.quantity) *
                                  Number(produto.item_price),
                              )}
                            </span>
                          </div>

                          {/* Ingredientes e adicionais selecionados */}
                          {(produto.options ?? []).length > 0 && (
                            <div className="mt-3 border-t border-slate-200 pt-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Ingredientes selecionados
                              </p>

                              <div className="space-y-2">
                                {produto.options.map((opcao) => (
                                  <div
                                    key={opcao.id}
                                    className="flex items-start justify-between gap-3 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-semibold text-slate-600">
                                        {opcao.group_name}:
                                      </span>{" "}
                                      <span className="text-slate-700">
                                        {opcao.option_name}
                                      </span>
                                    </div>

                                    {Number(opcao.additional_price) > 0 && (
                                      <span className="shrink-0 font-semibold text-green-600">
                                        +
                                        {formatCurrency(opcao.additional_price)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PAGAMENTO */}
                  <div className="border-b border-slate-100 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">Pagamento</span>

                      <span className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                        {pedido.payment_method || "Não informado"}
                      </span>
                    </div>

                    {Number(pedido.change_for) > 0 &&
                      pedido.payment_method === "Dinheiro" && (
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-500">Troco para</span>

                          <span className="font-semibold text-slate-700">
                            {formatCurrency(Number(pedido.change_for))}
                          </span>
                        </div>
                      )}

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm font-semibold text-slate-700">
                        Total do pedido
                      </span>

                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(pedido.total_price)}
                      </span>
                    </div>
                  </div>

                  {/* AÇÕES */}
                  <div className="space-y-3 p-5">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        handleFinalizar(pedido.order_id, pedido.status)
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isPending
                          ? "bg-orange-500 hover:bg-orange-600"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Atualizando...
                        </>
                      ) : isPending ? (
                        <>
                          <Send size={18} />
                          Enviar pedido
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          Finalizar pedido
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const content = formatSales(
                            pedido,
                            lanchoneteProfile,
                          );

                          downloadTextFile(
                            `pedido-${pedido.order_id}.txt`,
                            content,
                          );
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Download size={17} />
                        Comprovante
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteModalOrderId(pedido.order_id)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 size={17} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <ShoppingBag size={32} />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-800">
              Nenhum pedido encontrado
            </h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {search || filter !== "all"
                ? "Tente alterar os filtros ou a pesquisa."
                : "Os novos pedidos aparecerão aqui automaticamente."}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
