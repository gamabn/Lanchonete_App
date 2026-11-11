import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  // Only same-origin pages may exchange the HttpOnly session for a ticket.
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Origem inválida" }, { status: 403, headers });
  }
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ message: "Não autenticado" }, { status: 401, headers });
  try {
    const response = await api.post<{ ticket: string }>("/orders/socket-ticket", {}, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
    });
    return NextResponse.json({ ticket: response.data.ticket }, { headers });
  } catch (error) {
    const status = isAxiosError(error) && error.response?.status === 401 ? 401 : 503;
    return NextResponse.json({ message: "Não foi possível autorizar os pedidos" }, { status, headers });
  }
}
