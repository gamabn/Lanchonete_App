"use client"
import { createContext, ReactNode, useState, useEffect} from "react"
import api from "../util/api"; // Sua instância do axios/fetch
import { LanchoneteProfile } from "../models/interface"
import { Message } from "../models/interface";
import { ModalItem } from "../components/ModalItem";
import { VendasProps } from "../models/interface";
import { set } from "zod";


// Criamos um tipo estendido para o estado interno, que inclui o order_id
// para facilitar a vinculação no frontend.
type MessageWithOrder = Message & {
  order_id?: string;
}

// 1. Defina a interface para o usuário que sua API retorna
//    Ajuste os campos conforme o que sua rota /me retorna.
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  // adicione outros campos que sua API /me retorna
}

interface ModalProps {
   // A função Cadastro precisará ser refatorada para usar sua API Node
   // Cadastro: (data: LanchoneteProps, image: File | null) => void;
   user: ApiUser | null;
   lanchoneteProfile: LanchoneteProfile | null;
   loadingAuth: boolean; // Adicionado para saber quando a verificação de auth terminou
   logout: () => void;
   chatMessage: (idChat: string) => void;
   ChatId: (id: string) => void;
   messages: MessageWithOrder[];
   visible: Boolean;
   setVisible: React.Dispatch<React.SetStateAction<Boolean>>
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


export const Context = createContext({} as ModalProps)

export function ContextProvider({children}: {children: ReactNode}){
   const [user, setUser] = useState<ApiUser | null>(null)
   const [lanchoneteProfile, setLanchoneteProfile] = useState<LanchoneteProfile | null>(null);
   const [loadingAuth, setLoadingAuth] = useState(true); // Começa true para mostrar loading inicial
   const [messages, setMessages] = useState<MessageWithOrder[]>([])
   const [visible, setVisible] = useState<Boolean>(false);
   const [sales, setSales] = useState<VendasProps[]>([])



    useEffect(() => {
      // Função para buscar os dados do usuário quando o App carrega
      async function fetchUser() {
        try {
          // O cliente não lê mais o cookie. Ele pede ao nosso servidor Next.js,
          // que é o único que pode ler o cookie httpOnly.
          // A chamada deve ser para a rota interna do Next.js, não para a API backend.
          // Usamos fetch() para uma chamada relativa, pois a rota `/api/profile`
          // está no mesmo servidor Next.js que está servindo a página.
          const response = await fetch("/api/profile");

          if (!response.ok) {
            // Se a resposta não for 2xx, lança um erro para cair no bloco catch.
            throw new Error(`Falha ao buscar perfil: ${response.statusText}`);
          }
          const data = await response.json();

          // IMPORTANTE: Ajuste 'response.data' para a estrutura que sua API retorna.
          // Ex: se sua API retorna { user: {...}, restaurant: {...} }
          const userData: ApiUser = data; // ou data.user
          const restaurantData: LanchoneteProfile = data; // ou data.restaurant

          setUser(userData);
          setLanchoneteProfile(restaurantData);

        } catch (error) {
          // Se a chamada para /api/profile falhar (ex: token inválido),
          // o estado do usuário será limpo.
          // console.error("Falha ao buscar dados do usuário no cliente:", error);
          setUser(null);
          setLanchoneteProfile(null);
        } finally {
          // A verificação de autenticação terminou.
          setLoadingAuth(false);
        }
      }

      fetchUser();
    }, []);

   async function ChatId(order_id: string) {
      if (!order_id) return [];
      try {
        const responseId = await api.get(`/chat/${order_id}`);
        const idChat = responseId.data.chat_id;
        if (!idChat) return [];

        const responseMsg = await api.get(`/message/${idChat}`);
        const newMessages: Message[] = responseMsg.data;

        // PONTO CRÍTICO: Adicionamos o order_id a cada mensagem antes de salvar.
        // Isso cria o vínculo entre a mensagem e o pedido no frontend.
        const messagesWithOrderId = newMessages.map(msg => ({
          ...msg,
          order_id: order_id,
        }));

        setMessages(prevMessages => {
          // Removemos mensagens antigas deste chat para evitar duplicatas
          const otherMessages = prevMessages.filter(msg => msg.chat_id !== idChat);
          return [...otherMessages, ...messagesWithOrderId];
        });
      } catch (err) {
        console.log(err);
        return [];
      }
}

    async function chatMessage(idChat: string){
      if(!idChat)return;

    try{
      const response = await api.get(`/message/${idChat}`)
      setMessages(response.data)
    }catch(err){
      console.log(err)
    }
    }

    async function logout() {
      try {
        // Faz a chamada para a rota de API que deleta o cookie no servidor
        await fetch('/api/profile', { method: 'DELETE' });
      } catch (error) {
        console.error("Falha ao comunicar com o servidor para logout:", error);
      } finally {
        // Limpa os estados do lado do cliente independentemente do sucesso da API
        setUser(null);
        setLanchoneteProfile(null);
        window.location.href = '/'; // Redireciona para a página inicial
      }
    }

    function handleModalVisible(){
      setVisible(!visible)
    }

    function handleSales(dados: VendasProps[]){
      console.log('dados do Contexto',dados)
     setSales(dados)
    }

    return(
        <Context.Provider value={{ user,sales, handleSales, lanchoneteProfile, loadingAuth,visible, setVisible, logout, chatMessage, ChatId, messages, handleModalVisible }}>
          {visible && <ModalItem/>}
            {children}
        </Context.Provider>
    )

}