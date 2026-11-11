import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAxiosError } from "axios";
import api from "@/app/util/api";
async function handle(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers });
  try {
    const response = await api.request<unknown>({
      method: request.method, url: request.method === "PATCH" ? "/order" : "/order_item",
      data: await request.json(), headers: { Authorization: `Bearer ${token}` }, timeout: 15000,
    });
    return NextResponse.json(response.data, { headers });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status || 503 : 503;
    return NextResponse.json({ error: "Não foi possível alterar o pedido." }, { status, headers });
  }
}
export { handle as PATCH, handle as DELETE };
