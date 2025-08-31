"use client";
import { useState, useEffect, useMemo } from "react";
import { FaMotorcycle } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { parseRealToCents,formatReal  } from "@/app/components/money";
import { Delete } from "../../Delete";
import { toast } from "react-toastify";
import { Printer } from 'lucide-react';
import api from "@/app/util/api";
import { useContext } from "react";
import { Context } from "@/app/Context";
import { LanchoneteProfile } from "@/app/models/interface"; 
import { format, isValid } from 'date-fns'
import { Message } from "@/app/models/interface";
import { VendasProps } from "@/app/models/interface";
import socket from "@/app/components/Socket";




const dowloadTextFile = (fileName: string, text: string) => {
  const element = document.createElement("a");
  const file = new Blob([text], {type: 'text/plain;charset=utf-8'});
  element.href = URL.createObjectURL(file);
  element.download = fileName;
  document.body.appendChild(element); // Necessário para funcionar no Firefox
  element.click();
  // Limpeza: A URL do objeto Blob deve ser revogada para liberar memória.
  URL.revokeObjectURL(element.href);
  element.remove(); // .remove() é mais seguro que removeChild, pois não lança erro se o nó já foi removido.

}

function formatSales(pedido: VendasProps, lanchoneteProfile: LanchoneteProfile | null){
       let receiptText = "COMPROVANTE DE VENDA\n";

       if(lanchoneteProfile?.name){
        receiptText += `Lanchonete: ${lanchoneteProfile.name}\n`;
       }
       receiptText += `===========================================================\n`;
       let saleData: Date | null = null;
       if(pedido.created_at){
        saleData = new Date(pedido.created_at);
       }else if(typeof pedido.created_at === 'string' || typeof pedido.created_at === 'number'){
        saleData = new Date(pedido.created_at);     
       }
        if (saleData && isValid(saleData)) {
            receiptText += `Data/Hora: ${format(saleData, 'dd/MM/yyyy HH:mm:ss')}\n`;
          } else {
            receiptText += `Data/Hora: Não disponível\n`;
          }
           receiptText += `ID da Venda: ${pedido.order_id}\n`;
           receiptText += `Cliente: ${pedido.customer.name}\n`;
           receiptText += `Telefone: ${pedido.customer.phone}\n`;
           receiptText += `Endereço: ${pedido.customer.street}, ${pedido.customer.number}\n`;
           receiptText += `Bairro: ${pedido.customer.neighborhood}\n`;
           receiptText += `Cidade: ${pedido.customer.city}\n`;
           receiptText += `Complemento: ${pedido.customer.complement || 'Não informado'}\n`;

           receiptText+= `===========================================================\n`;

           receiptText += "\n--- Produtos ---\n";
           receiptText += "\n--- Produtos ---\n";
          pedido.items.forEach(item => {
                receiptText += `- ${item.product_name}\n`;
                receiptText += `  Qtd: ${item.quantity} x ${formatReal(item.item_price)}\n`;
                receiptText += `  Total: ${formatReal(item.quantity * item.item_price)}\n`;
              });

              receiptText += `===========================================================\n`;
                receiptText += `TOTAL DA VENDA: ${formatReal(pedido.total_price)}\n`;
                if (pedido.payment_method) {
                  receiptText += `Forma de Pagamento: ${pedido.payment_method}\n`;
                }
                if (pedido.change_for > 0) {
                  receiptText += `(Troco para...): ${formatReal(pedido.change_for)}\n`;
                }

                 receiptText += "\nObrigado pela preferência!\n";
                 return receiptText;
}

export function Home({ data }: { data: VendasProps[] }) {
   const [orders, setOrders] = useState<VendasProps[]>(data);
  const [deleteModalOrderId, setDeleteModalOrderId] = useState<string | null>(null);
  const { lanchoneteProfile, chatMessage, ChatId, messages } = useContext(Context)
 const [messagesCount, setMessagesCount] = useState<Record<string, number>>({});
 const [messagesLoaded, setMessagesLoaded] = useState(false);
  const router = useRouter();
  

   useEffect(() => {
    // Quando entrar na tela, conectar no socket
    socket.on("newOrder", (newOrder) => {
     // console.log("Novo pedido recebido via socket:", newOrder);

      // Atualiza lista (mantém os pedidos atuais + novo)
      setOrders((prev) => [newOrder, ...prev]);
    });

    return () => {
      socket.off("newOrder"); // cleanup para evitar múltiplos listeners
    };
  }, []);

  // Usamos useMemo para evitar que `dataPending` seja recriado a cada renderização,
  // o que causaria um loop infinito no useEffect.
  const dataPending = useMemo(() =>
    orders.filter(
      (item) => item.status === 'pending' || item.status === 'enviado'
    ),
    [orders]
  );

  // Este useEffect agora está no lugar certo (nível superior do componente)
  // e carrega as mensagens para todos os pedidos pendentes de forma eficiente.
  useEffect(() => {
    async function loadAllMessages() {
      // Executa todas as buscas de mensagens em paralelo para mais performance
      await Promise.all(
        dataPending.map(pedido => pedido.order_id ? ChatId(pedido.order_id) : Promise.resolve())
      );
      setMessagesLoaded(true);
    }
    if (dataPending.length > 0) loadAllMessages();
  }, [dataPending, ChatId]); // Dependências corretas

 
 async function handleFinalizar(order_id: string, status: string) {
  // console.log("Finalizando pedido:", order_id);
   // console.log("Status atual:", status);
    

    if(!order_id) return;

   try{
  if(status === 'pending'){
    await api.patch('/order', {
      id: order_id,
      status: 'enviado'
     
    })}else{
      await api.delete(`/chat/${order_id}`)

       await api.patch('/order', {
        id: order_id,
        status: 'completed'
      })
      
    }
    document.location.reload()
   
   }catch(err){
    console.log(err)
    toast.error('Erro ao finalizar pedido')
   }
  }

  return (
    <div className="p-6 flex flex-col">

     {deleteModalOrderId  && <Delete id={deleteModalOrderId} onClose={() => setDeleteModalOrderId(null)} />}
     
      <h1 className="text-2xl flex gap-2 items-center justify-center font-bold p-3 text-center">
        <span>
          <FaMotorcycle size={35} color="#00ff" />
        </span>
        Pedidos para entrega
      </h1>

      <div>
        {dataPending && dataPending.length > 0 ? (
          <div className="flex flex-wrap gap-4 max-sm:flex-col max-sm:justify-center">
            {dataPending.map((pedido) => (
              <div
                key={pedido.order_id}
                className="border p-4 rounded-xl shadow-md bg-white"
              >
                {/* Cabeçalho do Pedido */}
                <div className="flex  flex-col  mb-2">
                   <p className="text-blue-500">
                      {/* CORREÇÃO: Agora comparamos msg.order_id com pedido.order_id */}
                      Mensagens: {messagesLoaded 
                        ? messages.filter(msg => msg.order_id === pedido.order_id)
                            .length
                        : "..."}
                    </p>
                  <div className="flex justify-between items-center">
                      <h2 className="font-medium text-sm">
                          Cliente: <span className="text-black font-bold text-lg">{pedido.customer.name}</span>
                       </h2>
                  <span>
                   
                    <button 
                    onClick={() => {
                      const contentText = formatSales(pedido,lanchoneteProfile );
                      dowloadTextFile('pedido.txt', contentText)
                    }}
                    className="border p-1 rounded-sm bg-black">
                      <Printer color="#00ff" size={25}/>
                      </button>
                     
                  </span>
                  </div>
                  
                  <span className="text-sm text-gray-500">
                    {new Date(pedido.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Info Cliente */}
                <div>
                    <p className="text-gray-600 text-sm">
                  📍 {pedido.customer.city} | 📞 {pedido.customer.phone}
                     </p>
                     <p className="text-gray-600 text-sm">
                       Cidade: {pedido.customer.neighborhood}
                     </p>
                     <p className="text-gray-600 text-sm">
                        {pedido.customer.street}, {pedido.customer.number}
                     </p>
                     {pedido.customer.complement && (
                            <p className="text-gray-600 text-sm">
                        {pedido.customer.complement}
                     
                     </p>
                     )}
                     
                </div>
                

                {/* Lista de Itens */}
                <div className="mt-3">
                  <h3 className="font-semibold">Itens:</h3>
                  <ul className="list-disc ml-5 mt-1 text-gray-700">
                    {pedido.items.map((produto) => (
                      <li
                      className="text-sm"
                       key={produto.id}>
                        {produto.product_name} x{produto.quantity} — R${" "}
                        {formatReal(produto.item_price)}
                      </li>
                    ))}
                  </ul>
                </div>
                  <div className="flex gap-2 items-center justify-between">
                    <p className="text-green-500 border p-2 rounded-xl">
                        {pedido.payment_method}
                        </p>
                        {pedido.change_for > 0 && pedido.payment_method === 'Dinheiro' && (
                            <p className=" text-sm font-light  p-2 ">
                        Troco: <span className="text-green-500 font-bold">{formatReal(pedido.change_for)}</span> 
                        </p>
                        )}
                  
                  </div>
                {/* Rodapé com Total e Botão */}
                <div className="flex justify-between items-center mt-2">
                  <h2 className="font-light text-sm">Total:</h2>
                  <h2 className="font-bold text-lg text-green-500">{formatReal(pedido.total_price)}</h2>
                </div>
                <div className="flex justify-around gap-2 items-center mt-2">
                  <div className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow">
                    <button
                    onClick={() => setDeleteModalOrderId(pedido.order_id)}
                    >Excluir</button>
                  </div>
                  <button
                    onClick={() => handleFinalizar(pedido.order_id, pedido.status)}
                    className= { `${pedido.status === "pending" ? "bg-green-600" : "bg-blue-500"} text-white px-4 py-2 rounded-lg shadow`}
                  >
                   {pedido.status == 'pending' ? 'Enviar Pedido' : 'Finalizar Pedido'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <h2 className="text-center text-gray-500">
            Nenhum pedido encontrado
          </h2>
        )}
      </div>
    </div>
  );
}
