// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  console.log(`[Middleware] Interceptando: ${request.nextUrl.pathname}`);
  console.log(`[Middleware] Token encontrado: ${token ? "Sim" : "Não"}`);

  if (!token) {
    console.log("[Middleware] Token não encontrado. Redirecionando para /");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_RENDER;
  console.log(`[Middleware] URL da API: ${apiUrl}`);

  if (!apiUrl) {
    console.error(
      "[Middleware] ERRO GRAVE: A variável de ambiente API_URL não está configurada."
    );
    // Mesmo se falhar, vamos tentar deletar o cookie e redirecionar
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("token");
    return response;
  }

  try {
    // Usar o construtor URL para evitar problemas com barras duplas
    const validationUrl = new URL("/me", apiUrl).toString();
    console.log(`[Middleware] Validando token com a API em: ${validationUrl}`);
    const res = await fetch(validationUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    console.log(`[Middleware] Resposta da API: status ${res.status}`);

    if (!res.ok) {
      // Loga o corpo da resposta de erro da API para mais detalhes
      const errorBody = await res.text();
      console.error(
        `[Middleware] Token inválido. API respondeu com ${res.status}. Corpo da resposta: ${errorBody}`
      );
      throw new Error("Token inválido ou expirado.");
    }

    console.log("[Middleware] Token válido. Permitindo acesso ao dashboard.");
    return NextResponse.next();
  } catch (e: any) {
    // Loga o erro específico
    console.error("[Middleware] Erro ao validar token:", e.message);

    // Se o token for inválido ou a API falhar, remove o cookie e redireciona para o login
    console.log("[Middleware] Deletando cookie e redirecionando para /");
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("token");
    return response;
  }
}

// Limita o escopo do middleware a /dashboard
export const config = {
  matcher: ["/dashboard/:path*"],
};
