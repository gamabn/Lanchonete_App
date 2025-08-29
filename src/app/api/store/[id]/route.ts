import { NextRequest, NextResponse } from "next/server";
import api from "@/app/util/api";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop(); 

  if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

  try {
    const response = await api.get(`/user/${id}`);
    return NextResponse.json(response.data);
  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: 'Falha ao cancelar o agendamento.', details: errorMessage }, { status: 500 });
  }
}