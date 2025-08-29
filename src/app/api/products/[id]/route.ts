import { NextResponse, NextRequest } from "next/server";
import api from "@/app/util/api";

// Aqui, NÃO tipamos o segundo argumento manualmente
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); 

  if (!id) {
    return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });
  }

  try {
    const response = await api.get(`/product/${id}`);
    return NextResponse.json(response.data);
  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: 'Falha ao cancelar o agendamento.', details: errorMessage }, { status: 500 });
  }
}
