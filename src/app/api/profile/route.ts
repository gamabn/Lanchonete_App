import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;


  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    // 1. Usa o token do cookie para fazer a chamada segura para o seu backend
    const response = await api.get("/me", {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // 2. Retorna os dados do usuário obtidos do backend para o cliente
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    return NextResponse.json(
      { message: status === 401 ? "Sessão inválida ou expirada" : "Não foi possível consultar o perfil" },
      { status: status === 401 ? 401 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Prepara a instrução para o navegador deletar o cookie
    cookieStore.delete("token");

    // Retorna uma resposta de sucesso para o cliente
    return NextResponse.json(
      { message: "Logout realizado com sucesso" },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Erro ao realizar logout" },
      { status: 500 },
    );
  }
}
