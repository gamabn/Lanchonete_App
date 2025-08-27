import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import api from "@/app/util/api";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token =  cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  try {
    // 1. Usa o token do cookie para fazer a chamada segura para o seu backend
    const response = await api.get("/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // 2. Retorna os dados do usuário obtidos do backend para o cliente
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Erro na rota /api/profile:", error);
    return NextResponse.json({ message: "Falha ao buscar perfil do usuário" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token");

    if (!token) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
    }

    // Prepara a instrução para o navegador deletar o cookie
    cookieStore.delete("token");

    // Retorna uma resposta de sucesso para o cliente
    return NextResponse.json({ message: "Logout realizado com sucesso" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Erro ao realizar logout" }, { status: 500 });
   }
}