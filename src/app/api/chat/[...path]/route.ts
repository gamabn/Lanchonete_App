import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const headers = { "Cache-Control": "no-store" };
  const { path } = await context.params;
  const target = path.join("/");
  const method = request.method;
  const allowed = (method === "GET" && /^(chat(?:\/[^/]+)?|message\/[^/]+)$/.test(target)) ||
    (method === "POST" && (target === "message" || target === "chat/socket-ticket")) ||
    (method === "DELETE" && /^chat\/[^/]+$/.test(target));
  if (!allowed) return NextResponse.json({ error: "Rota inválida" }, { status: 404, headers });
  if (method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem inválida" }, { status: 403, headers });
  }
  // Public customers supply only an order-specific credential. Owners use the HttpOnly session.
  const customer = request.headers.get("x-chat-credential");
  const token = customer || (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers });
  try {
    const response = await api.request<unknown>({
      url: `/${path.map(encodeURIComponent).join("/")}`, method,
      data: method === "POST" ? await request.json() : undefined,
      headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
    });
    return NextResponse.json(response.data, { status: response.status, headers });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status || 503 : 503;
    return NextResponse.json({ error: "Não foi possível acessar a conversa" }, { status, headers });
  }
}
export { handle as GET, handle as POST, handle as DELETE };
