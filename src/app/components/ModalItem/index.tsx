"use client"
import { MouseEvent, use, useContext, useRef, useState } from "react";
import { Context } from "@/app/Context";
import { VendasProps } from "@/app/models/interface";
import { formatReal } from "../money";

export function ModalItem(){
    const{ handleModalVisible, sales} = useContext(Context)
    const modalREf = useRef<HTMLDivElement | null>(null)
   


 const handleModalClick = (e:MouseEvent<HTMLDivElement>) => {
  if(modalREf.current && !modalREf.current.contains(e.target as Node)){
  handleModalVisible()
  }

 }

    return(
    <div onClick={handleModalClick} className="bg-gray-800/85 absolute z-50 text-black flex p-5 justify-center w-full h-full ">
        <div>
          <div ref={modalREf}  className="bg-white w-full h-[80%] rounded-lg overflow-auto p-5">
            <h1 className="text-2xl text-center">Vendas Mensal</h1>
              {sales.map((pedido) => (
              <div
                key={pedido.order_id}
                className="border p-4 mb-3 rounded-xl shadow-md bg-white"
              >
                {/* Cabeçalho do Pedido */}
              
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
                 
                 
                </div>
              </div>
            ))}

        </div>
        </div>
        
    </div>
    )
}

