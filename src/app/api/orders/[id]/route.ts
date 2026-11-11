import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAxiosError } from "axios";
import { customerCookieName } from "@/lib/customerCookie";
import api from "@/app/util/api";
import { readCustomerSession, customerSessionFailure } from "@/lib/customerSession";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  const { id } = await context.params;
  const token = (await cookies()).get(customerCookieName(id))?.value;
  if (!token) return NextResponse.json({ error: "Credencial de cliente ausente." }, { status: 401, headers });
  try {
    const expected = request.headers.get("x-customer-id");
    if (expected) {
      try {
        await readCustomerSession(token, id, expected);
      } catch (error) {
        return customerSessionFailure(error);
      }
    }
    const response = await api.post<unknown>(`/order/${encodeURIComponent(id)}`, await request.json(), {
      headers: { Authorization: `Bearer ${token}` }, timeout: 30000,
    });
    return NextResponse.json(response.data, { status: response.status, headers });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status || 503 : 503;
    const data = isAxiosError(error) ? error.response?.data : undefined;
    const message = status === 401 ? "Sua sessão expirou. Atualize seus dados e tente novamente."
      : status === 403 ? "Você não está autorizado a finalizar nesta loja."
      : status === 422 && typeof data?.error === "string" ? data.error
      : status === 422 ? "Produtos, endereço ou valores mudaram. Revise o pedido e o valor para troco."
      : "Não foi possível confirmar o pedido.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
