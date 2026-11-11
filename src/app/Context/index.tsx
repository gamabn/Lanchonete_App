"use client";
import chatApi from "@/app/util/chatApi";
import {
  createContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { LanchoneteProfile } from "../models/interface";
import { Message } from "../models/interface";
import { ModalItem } from "../components/ModalItem";
import { VendasProps } from "../models/interface";
import { useRouter } from "next/navigation";

// Criamos um tipo estendido para o estado interno, que inclui o order_id
// para facilitar a vinculação no frontend.
type MessageWithOrder = Message & {
  order_id?: string;
};

// 1. Defina a interface para o usuário que sua API retorna
//    Ajuste os campos conforme o que sua rota /me retorna.
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  // adicione outros campos que sua API /me retorna
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

interface ModalProps {
  authStatus: AuthStatus;
  authError: string;
  login: (email: string, password: string) => Promise<void>;
  revalidateAuth: () => Promise<boolean>;
  // A função Cadastro precisará ser refatorada para usar sua API Node
  // Cadastro: (data: LanchoneteProps, image: File | null) => void;
  user: ApiUser | null;
  lanchoneteProfile: LanchoneteProfile | null;
  loadingAuth: boolean; // Adicionado para saber quando a verificação de auth terminou
  logout: () => void;
  chatMessage: (idChat: string) => void;
  //ChatId: (id: string) => void;
  ChatId: (id: string) => Promise<boolean>;
  messages: MessageWithOrder[];
  visible: Boolean;
  setVisible: React.Dispatch<React.SetStateAction<Boolean>>;
  handleModalVisible: () => void;
  sales: VendasProps[];
  handleSales: (dados: VendasProps[]) => void;
}
interface LanchoneteProps {
  name: string;
  email: string;
  password: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  phone: string;
}

export const Context = createContext({} as ModalProps);

export function ContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [lanchoneteProfile, setLanchoneteProfile] =
    useState<LanchoneteProfile | null>(null);
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState("");
  const authVersion = useRef(0);
  const profileRequest = useRef<AbortController | null>(null);
  const loginPending = useRef(false);
  const loadingAuth = authStatus === "loading";
  const [messages, setMessages] = useState<MessageWithOrder[]>([]);
  const [visible, setVisible] = useState<Boolean>(false);
  const [sales, setSales] = useState<VendasProps[]>([]);

  // Every session transition invalidates all older profile responses, even if
  // abort arrives after their response has already been received.
  const revalidateAuth = useCallback(async () => {
    const version = ++authVersion.current;
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    setAuthStatus("loading");
    setAuthError("");

    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      if (version !== authVersion.current) return false;
      if (response.status === 401) {
        setUser(null);
        setLanchoneteProfile(null);
        setAuthStatus("unauthenticated");
        return false;
      }
      if (!response.ok)
        throw new Error(
          "Não foi possível validar sua sessão. Tente novamente.",
        );
      const data = await response.json();
      if (version !== authVersion.current) return false;
      setUser(data);
      setLanchoneteProfile(data);
      setAuthStatus("authenticated");
      return true;
    } catch (error) {
      if (version !== authVersion.current) return false;
      setAuthError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Não foi possível validar sua sessão. Tente novamente.",
      );
      setAuthStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    void revalidateAuth();
    return () => {
      ++authVersion.current;
      profileRequest.current?.abort();
    };
  }, [revalidateAuth]);

  async function login(email: string, password: string) {
    if (loginPending.current) throw new Error("Login já está em andamento.");
    loginPending.current = true;
    let profileChecked = false;
    ++authVersion.current;
    profileRequest.current?.abort();
    setAuthStatus("loading");
    setAuthError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.message || "Não foi possível fazer login.");
      profileChecked = true;
      if (!(await revalidateAuth()))
        throw new Error(
          "Não foi possível validar sua sessão. Tente novamente.",
        );
    } catch (error) {
      // Reconcile even when a POST times out after the server set the cookie.
      if (!profileChecked) await revalidateAuth();
      throw error;
    } finally {
      loginPending.current = false;
    }
  }
  //======================================================
  /* async function ChatId(order_id: string) {
    if (!order_id) return [];
    try {
      const responseId = await chatApi.get(`/chat/${order_id}`);
      const idChat = responseId.data.chat_id;
      if (!idChat) return [];

      const responseMsg = await chatApi.get(`/message/${idChat}`);
      const newMessages: Message[] = responseMsg.data;

      // PONTO CRÍTICO: Adicionamos o order_id a cada mensagem antes de salvar.
      // Isso cria o vínculo entre a mensagem e o pedido no frontend.
      const messagesWithOrderId = newMessages.map((msg) => ({
        ...msg,
        order_id: order_id,
      }));

      setMessages((prevMessages) => {
        // Removemos mensagens antigas deste chat para evitar duplicatas
        const otherMessages = prevMessages.filter(
          (msg) => msg.chat_id !== idChat,
        );
        return [...otherMessages, ...messagesWithOrderId];
      });
    } catch (err) {
      console.log(err);
      return [];
    }
  }*/
  //==============================================================================

  const ChatId = useCallback(async (order_id: string): Promise<boolean> => {
    if (!order_id) return false;

    try {
      const responseId = await chatApi.get(`/chat/${order_id}`);
      const idChat = responseId.data.chat_id;

      if (!idChat) return false;

      const responseMsg = await chatApi.get<Message[]>(`/message/${idChat}`);

      const messagesWithOrderId = responseMsg.data.map((msg) => ({
        ...msg,
        order_id,
      }));

      setMessages((prevMessages) => {
        const otherMessages = prevMessages.filter(
          (msg) => msg.chat_id !== idChat,
        );

        return [...otherMessages, ...messagesWithOrderId];
      });

      return true;
    } catch (error) {
      console.error(`Erro ao carregar mensagens do pedido ${order_id}:`, error);

      return false;
    }
  }, []);

  async function chatMessage(idChat: string) {
    if (!idChat) return;

    try {
      const response = await chatApi.get(`/message/${idChat}`);
      setMessages(response.data);
    } catch (err) {
      console.log(err);
    }
  }

  async function logout() {
    if (loginPending.current) return;
    ++authVersion.current;
    profileRequest.current?.abort();
    setAuthStatus("loading");
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error("Não foi possível sair. Tente novamente.");
      setUser(null);
      setLanchoneteProfile(null);
      setMessages([]);
      setSales([]);
      setAuthStatus("unauthenticated");
      router.replace("/auth/login");
      router.refresh();
    } catch {
      await revalidateAuth();
    }
  }

  function handleModalVisible() {
    setVisible(!visible);
  }

  function handleSales(dados: VendasProps[]) {
    console.log("dados do Contexto", dados);
    setSales(dados);
  }

  return (
    <Context.Provider
      value={{
        authStatus,
        authError,
        login,
        revalidateAuth,
        user,
        sales,
        handleSales,
        lanchoneteProfile,
        loadingAuth,
        visible,
        setVisible,
        logout,
        chatMessage,
        ChatId,
        messages,
        handleModalVisible,
      }}
    >
      {visible && <ModalItem />}
      {children}
    </Context.Provider>
  );
}
