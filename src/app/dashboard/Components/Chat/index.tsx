"use client";
import chatApi from "@/app/util/chatApi";

import {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
} from "react";

import {
  ArrowLeft,
  CheckCheck,
  Clock3,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Search,
  SendHorizontal,
  ShoppingBag,
  Store,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import { toast } from "react-toastify";
import { Context } from "@/app/Context";
import socket from "@/app/components/Socket";
import { joinChat, leaveChat } from "@/app/util/chatRooms";

interface ChatItem {
  chat_id: string;
  order_id: string;
  created_at: string;
  customer_name: string;
  restaurant_id: string;
}

interface Message {
  id: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
  name?: string;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR");
}

export function Chat({ chat }: { chat: ChatItem[] }) {
  const { lanchoneteProfile } = useContext(Context);

  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [customerTyping, setCustomerTyping] = useState(false);
  const [search, setSearch] = useState("");

  const [socketConnected, setSocketConnected] = useState(socket.connected);

  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setSelectedChat(null);
    setMessages([]);
    setCustomerTyping(false);
  }, [lanchoneteProfile?.id]);

  // Mantém apenas os chats desta lanchonete
  const myChats = useMemo(() => {
    return chat
      .filter((item) => item.restaurant_id === lanchoneteProfile?.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [chat, lanchoneteProfile?.id]);

  // Filtra pelo nome do cliente ou pedido
  const filteredChats = useMemo(() => {
    const term = search.toLowerCase().trim();

    return myChats.filter((item) => {
      return (
        item.customer_name.toLowerCase().includes(term) ||
        item.order_id.toLowerCase().includes(term)
      );
    });
  }, [myChats, search]);

  // Carrega mensagens da conversa selecionada
  useEffect(() => {
    let cancelled = false;

    async function getMessagesForChat() {
      if (!selectedChat) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setMessages([]);

      try {
        const response = await chatApi.get<Message[]>(
          `/message/${selectedChat.chat_id}`,
        );

        if (!cancelled) {
          setMessages(response.data);
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);

        if (!cancelled) {
          setMessages([]);
          toast.error("Não foi possível carregar as mensagens.");
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    }

    getMessagesForChat();

    return () => {
      cancelled = true;
    };
  }, [selectedChat?.chat_id, lanchoneteProfile?.id]);

  // Acompanha a conexão do Socket.IO
  useEffect(() => {
    function onConnect() {
      setSocketConnected(true);
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Recebe mensagens em tempo real
  useEffect(() => {
    if (!selectedChat?.chat_id || selectedChat.restaurant_id !== lanchoneteProfile?.id) return;

    const chatId = selectedChat.chat_id;
    let active = true;
    setCustomerTyping(false);
    function onTyping(data: { chatId: string; sender_type: string; isTyping: boolean }) {
      if (data.chatId === chatId && data.sender_type === "customer") setCustomerTyping(data.isTyping);
    }
    socket.on("typing", onTyping);

    function joinSelectedRoom() {
      joinChat(socket, chatId, () => {
        void chatApi.get<Message[]>(`/message/${chatId}`).then(response => {
          if (!active) return;
          setMessages(previous => {
            const merged = new Map(previous.map(message => [message.id, message]));
            response.data.forEach(message => merged.set(message.id, message));
            return [...merged.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        }).catch(() => toast.error("Não foi possível atualizar o histórico."));
      });
    }

    // Entra na sala
    joinSelectedRoom();

    // Reentra após uma reconexão
    socket.on("connect", joinSelectedRoom);

    function handleNewMessage(msg: Message) {
      // Não mistura mensagens de chats diferentes
      if (msg.chat_id !== chatId) return;

      setMessages((previous) => {
        // Evita mensagens duplicadas
        const exists = previous.some((item) => item.id === msg.id);

        if (exists) return previous;

        return [...previous, msg];
      });
    }

    socket.on("newMessage", handleNewMessage);

    return () => {
      active = false;
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", onTyping);
      socket.emit("typing", { chatId, isTyping: false });
      socket.off("connect", joinSelectedRoom);

      // Depende de o backend implementar leaveRoom
      leaveChat(socket, chatId);
    };
  }, [selectedChat?.chat_id, lanchoneteProfile?.id]);

  // Scroll automático
  useEffect(() => {
    if (loadingMessages) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loadingMessages]);

  // Envia mensagem
  async function sendHandle() {
    const text = input.trim();

    if (!selectedChat || !text || sending) return;

    if (!lanchoneteProfile?.id) {
      toast.error("Lanchonete não identificada.");
      return;
    }

    setSending(true);

    try {
      await chatApi.post("/message", {
        chat_id: selectedChat.chat_id,
        name: lanchoneteProfile.name,
        sender_type: "restaurant",
        sender_id: lanchoneteProfile.id,
        message: text,
      });

      setInput("");
      socket.emit("typing", { chatId: selectedChat.chat_id, isTyping: false });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);

      toast.error("Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  function selectChat(item: ChatItem) {
    setSelectedChat(item);
    setInput("");
    setShowMobileChat(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO DA PÁGINA */}
        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShoppingBag size={17} />
            <span>Atendimento ao cliente</span>
          </div>

          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <MessagesSquare size={30} className="text-orange-500" />
            Central de mensagens
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Converse com seus clientes e acompanhe os pedidos em tempo real.
          </p>
        </header>

        {/* CONTAINER DO CHAT */}
        <div className="flex h-[75vh] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* SIDEBAR */}
          <aside
            className={`w-full shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[320px] lg:w-[360px] ${
              showMobileChat ? "hidden" : "flex"
            }`}
          >
            {/* CABEÇALHO SIDEBAR */}
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Conversas
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {myChats.length} conversas disponíveis
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <MessageCircle size={22} />
                </div>
              </div>

              {/* PESQUISA */}
              <div className="relative mt-5">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente ou pedido..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            {/* LISTA */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredChats.length > 0 ? (
                filteredChats.map((item) => {
                  const isSelected = selectedChat?.chat_id === item.chat_id;

                  return (
                    <button
                      key={item.chat_id}
                      type="button"
                      onClick={() => selectChat(item)}
                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-l-4 border-l-orange-500 bg-orange-50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* AVATAR */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                          isSelected
                            ? "bg-orange-100 text-orange-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <UserRound size={23} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.customer_name}
                          </p>

                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          Pedido #{item.order_id.slice(0, 8)}
                        </p>

                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <MessageCircle size={12} />
                          Toque para abrir a conversa
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                  <MessageCircle size={40} className="text-slate-300" />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    Nenhuma conversa encontrada
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {search
                      ? "Tente buscar por outro nome."
                      : "As conversas aparecerão aqui quando os clientes fizerem pedidos."}
                  </p>
                </div>
              )}
            </div>

            {/* RODAPÉ SIDEBAR */}
            <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-4">
              {socketConnected ? (
                <>
                  <Wifi size={16} className="text-green-500" />
                  <span className="text-xs font-medium text-green-600">
                    Atendimento conectado
                  </span>
                </>
              ) : (
                <>
                  <WifiOff size={16} className="text-red-500" />
                  <span className="text-xs font-medium text-red-500">
                    Conexão indisponível
                  </span>
                </>
              )}
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          <section
            className={`min-w-0 flex-1 flex-col ${
              showMobileChat ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedChat ? (
              <>
                {/* CABEÇALHO DA CONVERSA */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMobileChat(false)}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                      aria-label="Voltar para conversas"
                    >
                      <ArrowLeft size={21} />
                    </button>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <UserRound size={23} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                        {selectedChat.customer_name}
                      </h3>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        Pedido #{selectedChat.order_id.slice(0, 8)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      socketConnected
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        socketConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    />

                    <span className="hidden sm:inline">
                      {socketConnected ? "Conectado" : "Desconectado"}
                    </span>
                  </span>
                </div>

                {/* MENSAGENS */}
                <div
                  ref={messagesContainerRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/80 p-4 sm:p-6"
                >
                  {loadingMessages ? (
                    <div className="flex h-full flex-col items-center justify-center">
                      <Loader2
                        size={32}
                        className="animate-spin text-orange-500"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        Carregando mensagens...
                      </p>
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => {
                      const isRestaurant = msg.sender_type === "restaurant";

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isRestaurant ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${
                              isRestaurant
                                ? "rounded-br-md bg-orange-500 text-white"
                                : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {msg.message}
                            </p>

                            <div
                              className={`mt-2 flex items-center justify-end gap-2 text-[11px] ${
                                isRestaurant
                                  ? "text-orange-100"
                                  : "text-slate-400"
                              }`}
                            >
                              {msg.name && (
                                <span className="max-w-[120px] truncate">
                                  {msg.name}
                                </span>
                              )}

                              <span>{formatTime(msg.created_at)}</span>

                              {isRestaurant && <CheckCheck size={14} />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                        <MessageCircle size={31} />
                      </div>

                      <h3 className="mt-4 text-base font-semibold text-slate-800">
                        Início da conversa
                      </h3>

                      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                        Nenhuma mensagem ainda. Envie uma mensagem para iniciar
                        o atendimento.
                      </p>
                    </div>
                  )}

                  {customerTyping && <p className="text-sm text-slate-500">Cliente digitando...</p>}
                  <div ref={messagesEndRef} />
                </div>

                {/* CAMPO DE ENVIO */}
                <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <textarea
                        value={input}
                        onChange={(e) => { setInput(e.target.value); socket.emit("typing", { chatId: selectedChat.chat_id, isTyping: e.target.value.trim().length > 0 }); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendHandle();
                          }
                        }}
                        placeholder="Digite sua mensagem..."
                        rows={1}
                        disabled={sending}
                        className="max-h-32 min-h-12 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 disabled:opacity-60"
                      />

                      <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
                        Enter para enviar • Shift + Enter para quebrar linha
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={sendHandle}
                      disabled={sending || !input.trim()}
                      aria-label="Enviar mensagem"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <SendHorizontal size={21} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* SEM CONVERSA SELECIONADA */
              <div className="flex h-full flex-col items-center justify-center bg-slate-50/70 px-6 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
                  <MessagesSquare size={46} />
                </div>

                <h2 className="mt-6 text-xl font-bold text-slate-900">
                  Central de atendimento
                </h2>

                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  Selecione uma conversa na lista para visualizar as mensagens e
                  responder aos seus clientes.
                </p>

                <div className="mt-6 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
                  <Store size={15} />
                  {lanchoneteProfile?.name || "Sua lanchonete"}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
