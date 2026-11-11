import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/app/util/backend";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const login = () => NextResponse.redirect(new URL("/auth/login", request.url));
  if (!token) return login();

  try {
    if (!backendUrl) throw new Error("Backend não configurado");
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return login();
    if (!response.ok) throw new Error("Falha ao validar sessão");
    return NextResponse.next();
  } catch {
    // Fail closed without destroying a valid session during backend outages.
    // Never delete cookies here: a delayed prefetch may belong to an old session.
    return new NextResponse("Serviço temporariamente indisponível. Tente novamente.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
