"use client";
import { useEffect, useState, useRef } from "react";
import { SendHorizontal, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/app/util/api";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { FiLoader } from "react-icons/fi"

const socket = io(process.env.NEXT_PUBLIC_API_RENDER!, {
  transports: ["websocket"],
});


interface Message {
  id: string;
  name?: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
}

interface AddressData {
  name: string;
  phone: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento?: string;
}



export default function Chat() {
  const params = useParams();
  const idClient = params.idClient as string;
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [address, setAddress] = useState<AddressData | null>(null)
  const [isTyping, setIsTyping] = useState(false);
   const [loading, setLoading] = useState<boolean>(true)

   const [store,setStore] = useState({
      id: '',
      name: '',
      email: '',
      phone: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      open: false,
      image_url: '',
   })

   async function getStore(){
    if(idClient){
      const res = await fetch(`/api/store/${idClient}`)
      const data = await res.json()  
      // console.log('loja do cliente',data)
     setStore(data)
    
    }
  }
  // 🔹 1) Buscar chat_id a partir do order_id
  async function loadChat(order_id: string) {
    console.log("Order ID:", order_id);
    const cleanOrderId = order_id.replace(/^"|"$/g, "");
    console.log("Order ID limpo:", cleanOrderId);

    try {
      const res = await api.get(`/chat/${cleanOrderId}`); // sua rota GetChatService
      console.log("Chat:", res.data);
      if (res.data?.chat_id) {
        setChatId(res.data.chat_id);
        loadMessages(res.data.chat_id);
      }
    } catch (err) {
      console.error("Erro ao carregar chat:", err);
    }
  }

  // 🔹 2) Buscar mensagens do chat
  async function loadMessages(chat_id: string) {
    try {
      const res = await api.get(`/message/${chat_id}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  }
  const inputRef = useRef<HTMLInputElement>(null);
  // 🔹 3) Enviar mensagem
  async function sendMessage() {
    if (!input.trim() || !chatId) {
      if (!chatId) {
        toast.error("Não foi possível identificar o chat. Tente recarregar a página.");
      }
      return;
    }

    if (!address) {
      toast.error("Informações do cliente não encontradas. Tente recarregar a página.");
      console.error("Tentativa de enviar mensagem sem 'address' carregado.");
      return;
    }
    console.log("📌 Estado atual do address:", address);
    try {
      const res = await api.post("/message", {
        chat_id: chatId,   
        name: address.name,
        sender_type: "customer", // ou "restaurant"
        sender_id: idClient,
        message: input,
      });
   
     
      setInput("");
      inputRef.current?.focus();
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error("Falha ao enviar mensagem.");
    }
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

      useEffect(() => {
      if (!chatId) return;

      // entra na sala
      socket.emit("joinRoom", chatId);

      // recebe novas mensagens
      const handleNewMessage = (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
      };

      socket.on("newMessage", handleNewMessage);
     
      return () => {
        socket.off("newMessage", handleNewMessage);
      };
  }, [chatId]);


useEffect(() => {
  if (!chatId) return;

  // Receber mensagens digitando
  const handleTypingEvent = (data: { chatId: string; sender_id: string; isTyping: boolean }) => {
    if (data.sender_id !== idClient) { // só mostrar se não for você mesmo
      setIsTyping(data.isTyping);
    }
  };

  socket.on("typing", handleTypingEvent);

  return () => {
    socket.off("typing", handleTypingEvent);
  };
}, [chatId, idClient]);

  // Carrega dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      // Carrega o endereço do localStorage
      const savedAddress = localStorage.getItem("customerInfo");
      if (savedAddress) {
        try {
          setAddress(JSON.parse(savedAddress));
        } catch (e) {
          console.error("Erro ao parsear endereço do localStorage", e);
        }
      }

      // Carrega o chat a partir do order_id no localStorage
      const order = localStorage.getItem("order");
      if (order) {
        await loadChat(order); // loadChat já limpa o ID
      } else {
        console.error("❌ Nenhum order encontrado no localStorage");
        toast.error("Não foi possível carregar o chat. Nenhum pedido encontrado.");
      }

      await getStore();
      setLoading(false);
    };

    loadInitialData();
  }, [idClient]); // Depende do idClient para recarregar se ele mudar

 

function handleTyping(e: React.ChangeEvent<HTMLInputElement>) {
  setInput(e.target.value);

  if (!chatId) return;

  socket.emit("typing", {
    chatId,
    sender_id: idClient,
    isTyping: e.target.value.length > 0, // true se estiver digitando, false se apagar tudo
  });
}

  if(loading){
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full">
          <h1 className="text-2xl font-bold text-center p-3">Carregando...</h1>
            <FiLoader className="text-2xl text-center text-green-500 animate-spin"/>
        </div>
      )
    }
 
    return (
    <div className="w-full h-screen flex flex-col shadow">
      {/* Header */}
      <header className="flex items-center bg-amber-50 justify-between p-3 border-b">
        <Link href={`/clients/${idClient}`} className="font-bold">
          <ArrowLeft size={30} color="#00ff" />
        </Link>
        <div>
          <img 
          className="h-10 w-10 rounded-full max-sm:h-7 max-sm:w-7"
          src={store.image_url} alt="logo-loja" />
        </div>
        <div>
          <p className="font-bold text-xl max-sm:text-sm">{store.name}</p>
          </div>
      
      </header>

      {/* Mensagens */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            className={`p-2 rounded-lg max-w-[75%] ${
              msg.sender_type === "customer"
                ? "bg-blue-500 text-white self-end ml-auto"
                : "bg-gray-200 text-black self-start mr-auto"
            }`}
          >
            {msg.message}
          </div>
        ))}
          <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="border w-full rounded-lg px-2 py-2 focus:outline-none"
          placeholder="Digite sua mensagem..."
          value={input}
      //   onChange={(e) => setInput(e.target.value)}
          onChange={handleTyping}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button className="text-white rounded-lg" onClick={sendMessage}>
          <SendHorizontal size={25} color="#00ff" />
        </button>
      </div>
    </div>
  );
  }
  
  
