import type { VendasProps, LanchoneteProfile } from "../models/interface";
import { format, isValid } from "date-fns";
import { orderPresentation, formatOrderMoney as formatCurrency } from "./orderPresentation";

function formatDate(value: string): string {
  const date = new Date(value);
  return isValid(date) ? format(date, "dd/MM/yyyy 'às' HH:mm") : "Data não disponível";
}

// Gera o texto do comprovante
export function formatSales(
  pedido: VendasProps,
  lanchoneteProfile: LanchoneteProfile | null,
) {
  const view = orderPresentation(pedido);
  const restaurantName = view.pickup ? view.restaurantName
    : (lanchoneteProfile?.id === pedido.restaurant_id ? lanchoneteProfile.name : undefined);
  let text = "COMPROVANTE DE VENDA\n";

  if (restaurantName) text += `Lanchonete: ${restaurantName}\n`;

  text += "----------------------------------------\n";
  text += `Pedido: ${pedido.order_id}\n`;
  text += `Data: ${formatDate(pedido.created_at)}\n`;
  text += `Cliente: ${pedido.customer.name}\n`;
  text += `Telefone: ${pedido.customer.phone}\n`;

  text += `Modalidade: ${view.label}\n`;
  text += `${view.destinationLabel}:\n`;
  if (view.restaurantName) text += `${view.restaurantName}\n`;
  text += view.addressLines.join("\n") + "\n";

  text += "----------------------------------------\n";
  text += "PRODUTOS\n\n";

  pedido.items.forEach((item) => {
    text += `${item.product_name}\n`;

    // Tamanho ou variante selecionada
    if (item.variant_name) {
      text += `Tamanho: ${item.variant_name}\n`;
    }

    text += `Qtd: ${item.quantity}\n`;

    // Ingredientes e adicionais
    if (item.options?.length) {
      text += "INGREDIENTES:\n";

      item.options.forEach((opcao) => {
        text += `  ${opcao.group_name}: ${opcao.option_name}`;

        if (Number(opcao.additional_price) > 0) {
          text += ` (+${formatCurrency(opcao.additional_price)})`;
        }

        text += "\n";
      });
    }

    text += `Unitário: ${formatCurrency(item.item_price)}\n`;

    text += `Subtotal: ${formatCurrency(
      Number(item.quantity) * Number(item.item_price),
    )}\n\n`;
  });

  text += "----------------------------------------\n";
  text += `Subtotal dos produtos: ${view.subtotal}\n`;
  text += `Taxa de entrega: ${view.fee}\n`;
  text += `TOTAL: ${view.total}\n`;
  text += `Pagamento: ${pedido.payment_method || "Não informado"}\n`;

  if (Number(pedido.change_for) > 0) {
    text += `Troco para: ${formatCurrency(Number(pedido.change_for))}\n`;
  }

  text += "\nObrigado pela preferência!\n";

  return text;
}

