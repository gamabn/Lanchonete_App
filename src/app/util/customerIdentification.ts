import type { AddressData } from "@/app/clients/[idClient]/pedidos/component";

export interface IdentifiedCustomer {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  city: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
}

export class CustomerIdentificationError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

async function customerRequest(restaurantId: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`/api/client/${encodeURIComponent(restaurantId)}`, {
      ...init, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CustomerIdentificationError("CUSTOMER_UNAVAILABLE", "Falha de conexão. Confira a sessão novamente antes de continuar.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CustomerIdentificationError(body?.code ?? "CUSTOMER_UNAVAILABLE", body?.error ?? "Não foi possível acessar o cadastro.");
  }
  if (!body) throw new CustomerIdentificationError("CUSTOMER_UNAVAILABLE", "Resposta inválida ao consultar a sessão.");
  return body;
}

export async function currentCustomer(restaurantId: string): Promise<IdentifiedCustomer | null> {
  try {
    const rows = await customerRequest(restaurantId);
    const customer = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
    if (!customer || typeof customer.id !== "string" || customer.restaurant_id !== restaurantId ||
        typeof customer.name !== "string" || typeof customer.phone !== "string") {
      throw new CustomerIdentificationError("SESSION_INVALID", "A sessão retornou um cadastro inválido.");
    }
    return customer;
  } catch (error) {
    if (error instanceof CustomerIdentificationError && error.code === "SESSION_MISSING") return null;
    throw error;
  }
}

export function customerAddress(customer: IdentifiedCustomer): AddressData {
  return {
    name: customer.name, phone: customer.phone, cidade: customer.city,
    rua: customer.street ?? "", numero: customer.number ?? "",
    bairro: customer.neighborhood ?? "", complemento: customer.complement ?? "",
  };
}

export async function saveCustomerIdentification(
  restaurantId: string,
  address: AddressData,
  expected: IdentifiedCustomer | null,
): Promise<IdentifiedCustomer> {
  // Recheck on submit. A different tab may have replaced or ended the session.
  const current = await currentCustomer(restaurantId);
  if ((current?.id ?? null) !== (expected?.id ?? null)) {
    throw new CustomerIdentificationError("SESSION_CHANGED", "A sessão mudou. Confira novamente quem está fazendo o pedido.");
  }
  if (current && (address.name !== current.name || address.phone !== current.phone)) {
    throw new CustomerIdentificationError("CUSTOMER_IDENTITY_CHANGED", "Para trocar de pessoa, use Não sou eu / Trocar cliente.");
  }
  const customer = await customerRequest(restaurantId, {
    method: current ? "PUT" : "POST",
    headers: { "Content-Type": "application/json", ...(current ? { "X-Customer-Id": current.id } : {}) },
    body: JSON.stringify({
      name: current?.name ?? address.name, phone: current?.phone ?? address.phone,
      city: address.cidade, street: address.rua, number: address.numero,
      neighborhood: address.bairro, complement: address.complemento,
    }),
  });
  if (typeof customer.id !== "string" || customer.restaurant_id !== restaurantId ||
      (current && customer.id !== current.id)) {
    throw new CustomerIdentificationError("SESSION_INVALID", "A sessão retornou um cadastro inválido.");
  }
  return customer;
}

export function endCustomerSession(restaurantId: string) {
  return customerRequest(restaurantId, { method: "DELETE" });
}
