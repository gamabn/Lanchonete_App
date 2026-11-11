"use client";
import chatApi from "@/app/util/chatApi";
import { customerOrderKey, watchCustomerSessionChanges } from "@/app/util/customerStorage";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  MessageCircle,
  SendHorizontal,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import socket from "@/app/components/Socket";
import { joinChat, leaveChat } from "@/app/util/chatRooms";

interface Message {
  id: string;
  name?: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
}

interface StoreData {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  open: boolean;
  image_url: string;
}

const initialStore: StoreData = {
  id: "",
  name: "",
  email: "",
  phone: "",
  city: "",
  neighborhood: "",
  street: "",
  number: "",
  open: false,
  image_url: "",
};

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const msg of [...current, ...incoming]) {
    if (msg.id) byId.set(msg.id, msg);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const first = new Date(a.created_at).getTime();
    const second = new Date(b.created_at).getTime();
    return (
      (Number.isFinite(first) ? first : 0) -
      (Number.isFinite(second) ? second : 0)
    );
  });
}

function formatTime(date: string) {
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? ""
    : value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(date: string) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function Chat() {
  const params = useParams();
  const idClient = params.idClient as string;
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [store, setStore] = useState<StoreData>(initialStore);
  const [chatError, setChatError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => watchCustomerSessionChanges(idClient, () => {
    socket.disconnect();
    window.location.reload();
  }), [idClient]);

  const loadMessages = useCallback(async (id: string) => {
    const response = await chatApi.get<Message[]>(`/message/${id}`);
    if (chatIdRef.current !== id) return;
    if (Array.isArray(response.data)) {
      setMessages((previous) => mergeMessages(previous, response.data));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    chatIdRef.current = null;
    setChatId(null);
    setMessages([]);
    setChatError("");
    setLoading(true);

    async function initialize() {
      try {
        const savedOrder = localStorage.getItem(customerOrderKey(idClient));
        if (!savedOrder) {
          if (!cancelled)
            setChatError(
              "Nenhum pedido encontrado. Faça um pedido para conversar com a loja.",
            );
        } else {
          const cleanOrderId = savedOrder.replace(/^"|"$/g, "");
          try {
            const response = await chatApi.get<{ chat_id?: string }>(
              `/chat/${cleanOrderId}`,
            );
            if (!cancelled) {
              if (response.data?.chat_id) {
                chatIdRef.current = response.data.chat_id;
                setChatId(response.data.chat_id);
              } else {
                setChatError("O chat deste pedido ainda não está disponível.");
              }
            }
          } catch (error) {
            console.error("Erro ao carregar chat:", error);
            if (!cancelled)
              setChatError(
                "Não foi possível carregar a conversa. Tente novamente mais tarde.",
              );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function getStore() {
      try {
        const response = await fetch(`/api/store/${idClient}`);
        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
        const data = (await response.json()) as StoreData;
        if (!cancelled) setStore(data);
      } catch (error) {
        console.error("Erro ao carregar loja:", error);
      }
    }

    if (idClient) {
      void initialize();
      void getStore();
    }
    return () => {
      cancelled = true;
    };
  }, [idClient]);

  useEffect(() => {
    if (!chatId) return;
    const currentChatId = chatId;

    function joinRoom() {
      joinChat(socket, currentChatId, () => {
        void loadMessages(currentChatId).catch(() => setChatError("Não foi possível atualizar o histórico."));
      });
    }

    function handleNewMessage(msg: Message) {
      if (msg.chat_id !== currentChatId) return;
      setMessages((previous) => mergeMessages(previous, [msg]));
    }

    function handleTypingEvent(data: {
      chatId: string;
      sender_id: string;
      sender_type: string;
      isTyping: boolean;
    }) {
      if (data.chatId === currentChatId && data.sender_type === "restaurant") {
        setIsTyping(data.isTyping);
      }
    }

    joinRoom();
    socket.on("connect", joinRoom);
    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTypingEvent);
    void loadMessages(currentChatId).catch((error) => {
      console.error("Erro ao carregar mensagens:", error);
      toast.error("Não foi possível carregar as mensagens.");
    });

    return () => {
      socket.off("connect", joinRoom);
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", handleTypingEvent);
      socket.emit("typing", {
        chatId: currentChatId,
        sender_id: idClient,
        isTyping: false,
      });
      leaveChat(socket, currentChatId);
    };
  }, [chatId, idClient, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isTyping]);

  function handleTyping(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setInput(value);
    if (!chatId) return;
    socket.emit("typing", {
      chatId,
      sender_id: idClient,
      isTyping: value.trim().length > 0,
    });
  }

  async function sendMessage(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sendingRef.current) return;
    if (!chatId) {
      toast.error("Não foi possível identificar o chat.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      await chatApi.post("/message", {
        chat_id: chatId,
        message,
      });
      setInput((previous) => (previous === message ? "" : previous));
      socket.emit("typing", { chatId, sender_id: idClient, isTyping: false });
      inputRef.current?.focus();
      // A mensagem aparece pelo evento newMessage já utilizado pelo backend.
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Falha ao enviar mensagem. Tente novamente.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-orange-50 text-orange-600">
        <Loader2 className="h-9 w-9 animate-spin" />
        <p className="text-sm font-medium">Carregando conversa...</p>
      </div>
    );
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col bg-gradient-to-b from-orange-50 via-[#fffaf5] to-white text-slate-800">
      <header className="z-10 shrink-0 border-b border-orange-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/clients/${idClient}`}
            aria-label="Voltar ao cardápio"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-orange-600 transition hover:bg-orange-50"
          >
            <ArrowLeft size={22} />
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-orange-100 bg-orange-50">
            {store.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.image_url}
                alt={`Logo de ${store.name || "loja"}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-6 w-6 text-orange-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
              {store.name || "Atendimento da loja"}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
              {isTyping ? (
                <span className="font-medium text-orange-600">
                  Digitando...
                </span>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Chat
                  do seu pedido
                </>
              )}
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-600 sm:flex">
            <MessageCircle size={15} /> Atendimento
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <div
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7"
          aria-label="Mensagens da conversa"
        >
          <div className="mx-auto mb-6 max-w-sm rounded-2xl border border-orange-100 bg-white/90 px-4 py-3 text-center shadow-sm">
            <MessageCircle className="mx-auto mb-2 h-6 w-6 text-orange-500" />
            <p className="text-sm font-semibold text-slate-800">
              Conversa sobre seu pedido
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Envie suas dúvidas diretamente para a loja.
            </p>
          </div>

          {chatError ? (
            <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
              {chatError}
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma mensagem ainda. Comece a conversa!
            </p>
          ) : (
            messages.map((msg, index) => {
              const mine = msg.sender_type === "customer";
              const previous = messages[index - 1];
              const showDate =
                !previous ||
                formatDay(previous.created_at) !== formatDay(msg.created_at);
              return (
                <div key={msg.id || `${msg.created_at}-${index}`}>
                  {showDate && formatDay(msg.created_at) && (
                    <div className="mb-5 flex justify-center">
                      <span className="rounded-full border border-orange-100 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                        {formatDay(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${mine ? "rounded-br-md bg-orange-500 text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-800"}`}
                    >
                      {!mine && (
                        <p className="mb-1 text-xs font-semibold text-orange-600">
                          {msg.name || store.name || "Loja"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {msg.message}
                      </p>
                      <div
                        className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-orange-100" : "text-slate-400"}`}
                      >
                        <span>{formatTime(msg.created_at)}</span>
                        {mine && (
                          <CheckCheck size={13} aria-label="Mensagem enviada" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
                A loja está digitando<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="shrink-0 border-t border-orange-100 bg-white px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-5px_20px_rgba(0,0,0,0.03)] sm:px-6"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleTyping}
              disabled={!chatId || sending}
              placeholder={
                chatId ? "Digite sua mensagem..." : "Chat indisponível"
              }
              aria-label="Digite sua mensagem"
              className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!chatId || !input.trim() || sending}
              aria-label="Enviar mensagem"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-orange-200 disabled:shadow-none"
            >
              {sending ? (
                <Loader2 size={21} className="animate-spin" />
              ) : (
                <SendHorizontal size={21} />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Atendimento referente ao seu pedido
          </p>
        </form>
      </section>
    </main>
  );
}
