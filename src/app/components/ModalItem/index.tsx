"use client";

import { MouseEvent, useContext, useRef } from "react";
import { Context } from "@/app/Context";
import { formatReal } from "../money";
import { format } from "date-fns";

export function ModalItem() {
  const { handleModalVisible, sales } = useContext(Context);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const handleModalClick = (e: MouseEvent<HTMLDivElement>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleModalVisible();
    }
  };

  return (
    <div
      onClick={handleModalClick}
      className="bg-gray-800/85 fixed inset-0 z-50 flex justify-center p-5 text-black"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-3xl max-h-[90vh] rounded-lg overflow-y-auto p-5"
      >
        <h1 className="text-2xl text-center font-bold mb-5">Vendas Mensal</h1>

        {sales.map((pedido) => (
          <div
            key={pedido.order_id}
            className="border p-4 mb-3 rounded-xl shadow-md bg-white"
          >
            {/* Informações do cliente */}
            <div>
              <div className="flex justify-between items-center mb-2 gap-2">
                <p className="text-gray-600 text-sm font-bold">
                  {pedido.customer.name}
                </p>

                <p className="text-gray-600 text-sm">
                  {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm")}
                </p>
              </div>

              <p className="text-gray-600 text-sm">
                📍 {pedido.customer.city} | 📞 {pedido.customer.phone}
              </p>

              <p className="text-gray-600 text-sm">
                Bairro: {pedido.customer.neighborhood}
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

            {/* Itens do pedido */}
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Itens do pedido:</h3>

              <ul className="space-y-3">
                {pedido.items.map((produto) => (
                  <li
                    key={produto.id}
                    className="border rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">
                          {produto.quantity}x {produto.product_name}
                        </p>

                        {produto.variant_name && (
                          <p className="text-sm text-blue-600 font-medium">
                            Tamanho: {produto.variant_name}
                          </p>
                        )}
                      </div>

                      <p className="font-semibold text-sm whitespace-nowrap">
                        {formatReal(
                          Number(produto.item_price) * Number(produto.quantity),
                        )}
                      </p>
                    </div>

                    {/* Ingredientes selecionados */}
                    {(produto.options ?? []).length > 0 && (
                      <div className="mt-3 border-t pt-2">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          Ingredientes selecionados:
                        </p>

                        <ul className="space-y-1">
                          {produto.options.map((opcao) => (
                            <li
                              key={opcao.id}
                              className="flex justify-between gap-3 text-sm text-gray-600"
                            >
                              <span>
                                <span className="font-medium">
                                  {opcao.group_name}:
                                </span>{" "}
                                {opcao.option_name}
                              </span>

                              {Number(opcao.additional_price) > 0 && (
                                <span className="text-green-600 whitespace-nowrap">
                                  + {formatReal(opcao.additional_price)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pagamento */}
            <div className="flex gap-2 items-center justify-between mt-4">
              <p className="text-green-600 border p-2 rounded-xl">
                {pedido.payment_method}
              </p>

              {Number(pedido.change_for ?? 0) > 0 &&
                pedido.payment_method === "Dinheiro" && (
                  <p className="text-sm font-light p-2">
                    Troco:{" "}
                    <span className="text-green-600 font-bold">
                      {formatReal(Number(pedido.change_for))}
                    </span>
                  </p>
                )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mt-3 border-t pt-3">
              <h2 className="font-medium">Total:</h2>

              <h2 className="font-bold text-lg text-green-600">
                {formatReal(pedido.total_price)}
              </h2>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
