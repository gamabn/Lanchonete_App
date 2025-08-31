"use client"
import api from "@/app/util/api";
import { useState, useEffect, useRef, useContext } from "react";
import { FiLoader } from "react-icons/fi";
import { SendHorizontal } from "lucide-react";
import { Context } from "@/app/Context";
import socket from "@/app/components/Socket";


//const socket = io(process.env.NEXT_PUBLIC_API_RENDER!, {
 // transports: ["websocket"],
//});

interface Chat {
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

export function Chat({ chat }: { chat: Chat[] }) {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const { lanchoneteProfile } = useContext(Context);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const myChat = chat.filter((chatItem) => chatItem.restaurant_id === lanchoneteProfile?.id);
 //console.log('myChat',myChat)
  // Buscar mensagens do chat selecionado
  useEffect(() => {
    async function getMessagesForChat() {
      if (!selectedChat) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      try {
        const response = await api.get<Message[]>(`/message/${selectedChat.chat_id}`);
        setMessages(response.data);
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }

    getMessagesForChat();
  }, [selectedChat]);

  // WebSocket para novas mensagens
 {/*} useEffect(() => {
    if (!selectedChat?.chat_id) return;

    socket.emit("joinRoom", selectedChat.chat_id);

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [selectedChat?.chat_id]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);*/}


  useEffect(() => {
  if (!selectedChat?.chat_id) return;

  const chatId = selectedChat.chat_id;

  socket.emit("joinRoom", chatId);

  const handleNewMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  socket.on("newMessage", handleNewMessage);

  return () => {
    socket.off("newMessage", handleNewMessage);
    socket.emit("leaveRoom", chatId); // se você implementar no backend
  };
}, [selectedChat?.chat_id]);



  async function sendHandle() {
    if (!selectedChat || !input.trim()) return;

    try {
      await api.post("/message", {
        chat_id: selectedChat.chat_id,
        name: lanchoneteProfile?.name,
        sender_type: "restaurant",
        sender_id: lanchoneteProfile?.id, // ⚠️ Aqui é o ID do restaurante
        message: input,
      });
      setInput("");
    } catch (err) {
      console.log("Erro ao enviar mensagem:", err);
    }
  }
 
  return (
    <div className="flex w-full bg-gray-100 text-black">
      {/* Sidebar - Lista de Chats */}
      <div className="w-1/3 max-w-xs h-screen border-r border-gray-300 bg-gray-50 overflow-y-auto">
        <div className="p-4 font-bold border-b border-gray-300">Conversas</div>
        <ul>
          {myChat.map((chatItem) => (
            <li key={chatItem.chat_id}>
              <button
                onClick={() => setSelectedChat(chatItem)}
                className={`w-full text-left p-4 border-b border-gray-200 hover:bg-gray-200 ${
                  selectedChat?.chat_id === chatItem.chat_id
                    ? "bg-blue-100 font-semibold"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate">{chatItem.customer_name}</p>
                 <p>
                    {
                      messages.filter((msg) => msg.chat_id === chatItem.chat_id).length
                    }
                </p>
                 
                 
                </div>
                
                <p className="text-xs text-gray-500">
                  ID do Chat: {chatItem.chat_id?.substring(0, 8)}...
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Área Principal - Mensagens */}
      <div className="h-screen relative w-full flex flex-col shadow">
        {selectedChat ? (
          loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <FiLoader className="text-2xl text-green-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Mensagens */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg max-w-[75%] ${
                      msg.sender_type === "customer"
                        ? "bg-blue-500 text-white self-end ml-auto"
                        : "bg-gray-200 text-black self-start mr-auto"
                    }`}
                  >
                   
                    {msg.message}
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="text-shadow-gray-600 text-sm font-extralight px-2">{msg.name}</span>
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-300  items-center justify-between flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 border text-black text-sm rounded-lg px-3 py-2 outline-none"
                />
                <button
                  onClick={sendHandle}
                  className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"
                >
                  <SendHorizontal size={20} />
                </button>
              </div>
            </>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
