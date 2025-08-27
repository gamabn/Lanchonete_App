import { NextRequest, NextResponse } from "next/server";
import api from "@/app/util/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ precisa do await

  if (!id) {
    return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });
  }

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "Telefone não fornecido" }, { status: 400 });
  }

  try {
    const response = await api.get(`/client/${id}`, {
      params: { phone },
    });

    return NextResponse.json(response.data);
  } catch (err) {
    console.error("Erro ao buscar cliente:", err);
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
}
