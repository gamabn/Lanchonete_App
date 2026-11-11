import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

export async function PUT(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ message: "Origem inválida." }, { status: 403 });
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  try {
    const profile = await api.get<{ id: string }>("/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
    const form = await request.formData();
    const response = await api.put(`/user/image/${encodeURIComponent(profile.data.id)}`, form, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 30000,
    });
    return NextResponse.json(response.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status || 503 : 503;
    return NextResponse.json({ message: "Não foi possível atualizar a imagem." }, { status });
  }
}
