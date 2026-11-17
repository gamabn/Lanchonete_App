import type { LanchoneteProfile } from "../models/interface";
import type { AddressData } from "../clients/[idClient]/pedidos/component";

export type CheckoutFulfillment = "DELIVERY" | "PICKUP";

function field(value: unknown): string | undefined {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return;
  const clean = String(value).trim();
  if (!clean || /^(null|undefined|\[object Object\])$/i.test(clean) || /[\x00-\x1f\x7f]/.test(clean)) return;
  return clean;
}

export function pickupLocation(store: Partial<LanchoneteProfile>, restaurantId: string) {
  if (store.id !== restaurantId || store.status !== true) return null;
  const name = field(store.name), street = field(store.street), number = field(store.number);
  const neighborhood = field(store.neighborhood), city = field(store.city);
  return name && street && number && neighborhood && city ? {name,street,number,neighborhood,city} : null;
}

export function hasDeliveryAddress(address: AddressData | null): boolean {
  return Boolean(address && [address.rua,address.numero,address.bairro,address.cidade].every(value => typeof value === "string" && value.trim()));
}

/** Only the modality/region are sent. No address snapshot or monetary estimate. */
export function fulfillmentSelection(mode: CheckoutFulfillment, bairroId?: string) {
  if (mode === "PICKUP") return { fulfillment_type: "PICKUP" as const };
  if (mode !== "DELIVERY" || !bairroId) throw new Error("Selecione um bairro de entrega válido.");
  return { fulfillment_type: "DELIVERY" as const, bairro_id: bairroId };
}
