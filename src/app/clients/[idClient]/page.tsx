"use client"
import { useEffect, useState } from "react"
import {  ShoppingCart, MessageCircleMore} from "lucide-react"
import { toast } from "react-toastify"
import { MdDeliveryDining  } from "react-icons/md"
import { useParams } from "next/navigation"
import { FaInstagram, FaFacebook, FaTwitter } from "react-icons/fa";
import Link from "next/link"
import { Product, LanchoneteProfile } from "@/app/models/interface"
import { formatReal } from "@/app/money"
import { FiLoader } from "react-icons/fi"
import api from "@/app/util/api"
import { io } from 'socket.io-client'
import { Footer } from "./pedidos/component/footer"
import socket from "@/app/components/Socket"

interface Message {
  id: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
}

//const socket = io(process.env.NEXT_PUBLIC_API_RENDER!, {
 // transports: ["websocket"],
//});

export default function Client(){ 
    const param = useParams()
    const idClient = param.idClient as string
    const [loading, setLoading] = useState<boolean>(true)
    const [produtos,setProdutos] = useState<Product[]>([])
    const [carregar, setCarregar] = useState<boolean>(false)
    const [item,setItem] = useState<Product[]>([])  
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [store,setStore] = useState<LanchoneteProfile>({
      id: '',
      name: '',
      email: '',
      phone: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      status: true,
      image_url: '',
    })

  async function loadChat(order_id: string) {
   // console.log("Order ID:", order_id);
    const cleanOrderId = order_id.replace(/^"|"$/g, "");
  //  console.log("Order ID limpo:", cleanOrderId);
   // console.log('Chat id', chatId)

    try {
      const res = await api.get(`/chat/${cleanOrderId}`); // sua rota GetChatService
      console.log("Chat:", res.data);
      if (res.data?.chat_id) {
        setChatId(res.data.chat_id);
       
      }
    } catch (err) {
      console.error("Erro ao carregar chat:", err);
    }
  }

 

    // Efeito para ouvir atualizações de status da loja via socket
    useEffect(()=>{
      const handleStatusUpdate = (data: { status: boolean }) => {
        console.log("Status da loja (evento):", data.status);
        // Atualiza o estado da loja diretamente, em vez de um estado separado
        //setStore(prevStore => ({ ...prevStore, open: data.status }));
        setIsOpen(data.status)
     
      };

      socket.on("statusUpdated", handleStatusUpdate);
  
      return () => {
        socket.off("statusUpdated", handleStatusUpdate);
      };
    },[])

    // Efeito para carregar dados iniciais (loja, produtos, carrinho)
    useEffect(() => {
      async function loadInitialData() {
        if (!idClient) return;

        setLoading(true);
        try {
          // Busca dados da loja e produtos em paralelo
          const [storeRes, productsRes] = await Promise.all([
            fetch(`/api/store/${idClient}`),
            fetch(`/api/products/${idClient}`)
          ]);

          const storeData = await storeRes.json();
          const productsData = await productsRes.json();

          setStore(storeData);
          setProdutos(productsData);
          setIsOpen(storeData.status)


          // Carrega o carrinho do localStorage
          const cartFromStorage = localStorage.getItem('product');
          if (cartFromStorage) {
            setItem(JSON.parse(cartFromStorage));
          }
        } catch (error) {
          console.error("Falha ao carregar dados iniciais:", error);
          toast.error("Erro ao carregar a página da loja.");
        } finally {
          setLoading(false);
        }
      }

      loadInitialData();

      // Carrega o chat se houver um pedido no localStorage
        const order = localStorage.getItem("order");
      if (order) loadChat(order);
    }, [idClient])

   
    
     useEffect(() => {
      if (!chatId) return;
       async function loadMessages(chat_id: string) {
        try {
          const res = await api.get(`/message/${chat_id}`);
          setMessages(res.data);
        } catch (err) {
          console.error("Erro ao carregar mensagens:", err);
        }
      }
      loadMessages(chatId)
      
      
      }, [chatId]);

    if(loading){
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full">
          <h1 className="text-2xl font-bold text-center p-3">Carregando...</h1>
            <FiLoader className="text-2xl text-center text-green-500 animate-spin"/>
        </div>
      )
    }
  
  async function handleSales(product: Product){ 
     setCarregar(true)
     //console.log('Produto selecionado', product)

    // Usa o estado 'item' como fonte da verdade, não o localStorage
    const isAlreadyInCart = item.some((p: Product) => p.id === product.id);
    if (isAlreadyInCart) {
      toast.info('Já está no carrinho');
      setCarregar(false);
      return;
    }

    // Atualiza o estado e depois o localStorage
    const newItemList = [...item, product];
    setItem(newItemList);
    localStorage.setItem('product', JSON.stringify(newItemList));
  
    toast.success('Produto adicionado ao carrinho')
   setCarregar(false)
    
  }
 const chatMessage = messages.filter(item => item.sender_type === 'restaurant')
 
  
    return(
        <div className=" w-full flex flex-col text-black bg-amber-50">
           <header className="h-[150px]  relative top-0 flex items-center bg-[url('/ProjetoLanches.png')] bg-cover bg-no-repeat bg-center justify-center border-b">
            
             <div className="flex flex-col absolute  top-[115px] z-100">
                <img 
                  src={store?.image_url}
                  alt="logo" 
                  className="h-20 w-20 rounded-full"/> 
             </div>
           <div className="absolute top-5 bg-gray-700/85 rounded-full w-[40px] h-[40px] flex items-center justify-center right-3 max-sm:hidden">
           <Link href={`/clients/${idClient}/pedidos`} className="">
                 <ShoppingCart size={25} color="#00ff00" className=""/>
           </Link>
           {item?.length > 0 && (
               <div className="absolute top-8 rounded-full bg-blue-400 h-5 w-5 flex items-center justify-center text-white">
                <p className="p-1">{item?.length}</p> 
           </div>
           )}
          
          </div>
           </header>

       

             <div className=" flex flex-col pt-10 bg-amber-50 overflow-auto w-full rounded-t-xl h-screen">

              {chatId && isOpen  && (
                <div className=" flex items-center justify-center ">
                     <Link
                      className="flex items-center justify-center p-2 rounded-lg bg-amber-200 text-blue-600 mt-3 cursor-pointer"
                      href={`/clients/${idClient}/pedidos/component/chatClient`}>
                        {chatMessage.length > 0 ?(
                          <span className="flex items-center justify-center">Voce tem <p className="font-bold px-2 text-red-500"> {chatMessage.length}</p> mensagem <MessageCircleMore size={30}/></span> 
                        ):(
                           <span className="flex items-center justify-center">envie mensagem para a lanchonete <MessageCircleMore size={30}/></span> 
                        )}
                   
                  </Link>
                </div>
               
              )}
              
                 
               <h1 className="text-2xl font-bold text-center p-3">
               </h1>
               
                <div className="flex flex-col gap-3  mt-3  justify-center items-center">
                   <h1>{store?.name}</h1>
                    <div className="flex items-start justify-items-start text-black">
                     
                         <p className="w-full items-center flex"> Pedido Mínimo R$ 10  : <MdDeliveryDining size={30}/> -
                        20-30 min • Grátis</p>
                    
                    </div>
                    <div>
                       <p>{store.street}, {store.neighborhood}, {store.city}, {store.number}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-center">
                        
                        <p>{isOpen ? 'Aberto' : 'Fechado'}</p>
                        <p className={`h-4 w-4 ${isOpen ? 'bg-green-500' : 'bg-red-500'} rounded-full flex items-center justify-center animate-pulse`}></p>                       
                    </div>
                    {isOpen ?(
                      <div>
                      {produtos &&(
                      <div className="flex flex-wrap gap-3 mb-6">
                          {produtos.map((product, index)=>(
                              <div 
                              key={product.id}
                              className="flex gap-4 mt-2 p-3 max-sm:flex-col">
                                <div className="flex">
                                    <img src={product.image_url} alt="produtos"
                                    className="h-[200px] w-[200px]" />
                                    <div className="flex flex-col p-3">
                                        <p>{product.name}</p>
                                        <p>{product.description}</p>
                                        <p>{formatReal(product.price)}</p>

                                       <button
                                        disabled={carregar}
                                          key={product.id}
                                          onClick={() => handleSales(product)}
                                          className="h-11 w-full p-2 bg-green-500 mt-3 rounded-lg text-white">
                                        {carregar ? 'Carregando...' : 'Comprar'}
                                      </button>

                                    </div>
                                  
                                </div>
                            
                                </div>
                          ))}
                      </div>
                    
                  )}
                      </div>
                    ):(
                      <div>
                        <h2 className="text-2xl font-bold text-center p-3">
                          Esta loja está fechada no momento.
                        </h2>
                      </div>
                    )}
                 
                  
                  
                </div>
             </div>
             <div className="fixed bottom-0 w-full md:hidden">
                <Footer  itemProduct={item}/>   
             </div>
             
        </div>
    )
} 