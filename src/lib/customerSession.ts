import { isAxiosError } from "axios";
import { NextResponse } from "next/server";
import api from "@/app/util/api";

export interface CustomerSession {
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

export class CustomerSessionError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
  }
}

export const customerResponseHeaders = { "Cache-Control": "no-store" };

export function customerSessionFailure(error: unknown) {
  let status = 503;
  let code = "CUSTOMER_UNAVAILABLE";
  let message = "Não foi possível acessar o cadastro. Tente novamente.";
  if (error instanceof CustomerSessionError) {
    ({ status, code, message } = error);
  } else if (isAxiosError(error)) {
    status = error.response?.status ?? 503;
    if (status === 401) {
      code = error.response?.data?.code === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "SESSION_INVALID";
      message = code === "SESSION_EXPIRED" ? "Sua sessão expirou. Encerre a sessão para continuar." : "A sessão do cliente é inválida.";
    } else if (status === 403) {
      code = "CUSTOMER_FORBIDDEN";
      message = "Você não está autorizado a acessar este cadastro.";
    } else if (status === 404) {
      code = "CUSTOMER_NOT_FOUND";
      message = "O cadastro desta sessão não foi encontrado.";
    } else if (status === 409) {
      code = "CUSTOMER_CONFLICT";
      message = "Não foi possível criar um novo cadastro. A recuperação de cadastros antigos exige verificação de identidade.";
    } else if (status === 400) {
      code = "CUSTOMER_INPUT_INVALID";
      message = "Confira os dados do cliente.";
    }
  }
  return NextResponse.json({ error: message, code }, { status, headers: customerResponseHeaders });
}

export function missingCustomerSession() {
  return customerSessionFailure(new CustomerSessionError("SESSION_MISSING", 401, "Informe seus dados para iniciar um novo cadastro."));
}

export async function readCustomerSession(token: string, restaurantId: string, expectedId?: string) {
  const response = await api.get<CustomerSession[]>(`/client/${encodeURIComponent(restaurantId)}`, {
    headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
  });
  const customers = response.data;
  if (!Array.isArray(customers) || customers.length !== 1 ||
      customers[0].restaurant_id !== restaurantId || typeof customers[0].id !== "string") {
    throw new CustomerSessionError("SESSION_INVALID", 401, "A sessão retornou um cadastro inválido.");
  }
  const customer = customers[0];
  if (expectedId && customer.id !== expectedId) {
    throw new CustomerSessionError("SESSION_CHANGED", 409, "A sessão mudou. Confirme novamente quem está fazendo o pedido.");
  }
  return customer;
}
