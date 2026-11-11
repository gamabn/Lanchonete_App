import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import api from "@/app/util/api";
import { id } from "zod/locales";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    console.log("🍪 token:", token ? "TEM" : "NULL");
    const { bairro, valor } = await request.json();
    console.log("Valor do frete", valor);

    if (!bairro || valor === undefined || valor === null || valor === "") {
      return NextResponse.json(
        { message: "Todos os valores sao obrigatorios" },
        {
          status: 401,
        },
      );
    }

    if (!token) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
    }

    const response = await api.post(
      "/criar_bairro",
      {
        bairro,
        valor,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return NextResponse.json(response.data, { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor.";
    return NextResponse.json(
      { error: "Falha ao cadstrar Bairro.", details: errorMessage },
      { status: 500 },
    );
  }
}
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { message: "Token nao encontrado" },
        { status: 401 },
      );
    }

    const response = await api.get(`/bairros`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("Bairros ****", response.data);
    return NextResponse.json(response.data, { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro interno do servidor.";
    return NextResponse.json(
      { error: "Falha ao buscar bairros.", details: errorMessage },
      { status: 500 },
    );
  }
}
export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  const formData = await request.formData();
  const id = formData.get("id");
  const bairro = formData.get("bairro");
  const frete = formData.get("frete");

  if (!id || !bairro || !frete) {
    return NextResponse.json(
      { message: "Preencha todos os campos" },
      { status: 400 },
    );
  }

  try {
    const response = await api.put(
      `/edit-bairro/${id}`,
      { bairro: bairro.toString(), frete: frete.toString() },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // 👇 TEM que retornar a resposta pro fetch
    return NextResponse.json(response.data, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}
