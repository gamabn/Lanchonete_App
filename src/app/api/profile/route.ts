import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Não autenticado" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const response = await api.get("/me", {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return NextResponse.json(response.data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (isAxiosError(error)) {
      const status = error.response?.status;

      console.error("ERRO AO CONSULTAR PERFIL:", {
        status,
        data: error.response?.data,
      });

      // Sessão inválida
      if (status === 401) {
        return NextResponse.json(
          { message: "Sessão inválida ou expirada" },
          { status: 401 },
        );
      }

      // Assinatura vencida
      if (status === 403) {
        return NextResponse.json(
          error.response?.data ?? {
            message: "Assinatura vencida",
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { message: "Não foi possível consultar o perfil" },
      { status: 503 },
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
