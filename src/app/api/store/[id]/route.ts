import { NextRequest, NextResponse } from "next/server";
import api from "@/app/util/api";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop(); 

  if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

  try {
    const response = await api.get<Record<string, unknown>>(`/user/${id}`);
    const { id: storeId, name, phone, city, neighborhood, street, number, image_url, status } = response.data;
    return NextResponse.json({
      id: storeId, name, phone, city, neighborhood, street, number, image_url, status,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao consultar o estabelecimento.' }, { status: 500 });
  }
}
