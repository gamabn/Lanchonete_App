import { NextRequest, NextResponse } from "next/server";
import api from "@/app/util/api";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
 
 // id  = param.url);
   const url = new URL(req.url);
    const id = url.pathname.split('/').pop(); // pega o ID da rota


  if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

  try {
    const response = await api.get(`/user/${id}`);
    return NextResponse.json(response.data);
  } catch (err) {
    return NextResponse.json({ error: "Erro ao buscar loja" }, { status: 500 });
  }
}