import { NextResponse, type NextRequest } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Produto inválido." }, { status: 400, headers });
  }
  try {
    const response = await api.get(`/products/${id}/configuration`, { timeout: 15000 });
    return NextResponse.json(response.data, { headers });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status ?? 502 : 502;
    return NextResponse.json({
      error: status === 404 ? "Produto indisponível." : "Não foi possível carregar o produto. Tente novamente.",
    }, { status, headers });
  }
}
