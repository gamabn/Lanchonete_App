import type { VendasProps } from "../models/interface";

function clean(value: unknown): string | undefined {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return;
  const text = String(value).trim();
  if (!text || /^(null|undefined|\[object Object\])$/i.test(text) || /[\x00-\x1f\x7f]/.test(text)) return;
  return text;
}

/** Formats persisted values only; unknown historical amounts are never reconstructed. */
export function formatOrderMoney(value: unknown): string {
  if (value === null || value === undefined || value === "" ||
      (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)))) return "Não informado";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

export function orderPresentation(order: VendasProps) {
  const pickup = order.fulfillment_type === "PICKUP";
  // A missing PICKUP snapshot must NEVER fall back to customer or current profile.
  const address = pickup ? order.pickup_address : (order.delivery_address ?? order.customer);
  const street = clean(address?.street), number = clean(address?.number);
  const neighborhood = clean(address?.neighborhood), city = clean(address?.city);
  const complement = clean(address?.complement);
  const lines = [
    ...((street || number) ? [[street, number].filter(Boolean).join(", ")] : []),
    ...(neighborhood ? [`Bairro: ${neighborhood}`] : []),
    ...(city ? [`Cidade: ${city}`] : []),
    ...(complement ? [`Complemento: ${complement}`] : []),
  ];
  return {
    pickup,
    label: pickup ? "RETIRADA" : "ENTREGA",
    destinationLabel: pickup ? "Local de retirada" : "Endereço de entrega",
    restaurantName: pickup ? clean(address?.name) : undefined,
    addressLines: lines.length ? lines : [pickup ? "Endereço de retirada indisponível" : "Endereço de entrega indisponível"],
    subtotal: formatOrderMoney(order.subtotal),
    fee: formatOrderMoney(pickup ? 0 : order.delivery_fee),
    total: formatOrderMoney(order.total_price),
  };
}
