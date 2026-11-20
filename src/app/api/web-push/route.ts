import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const subscription = await request.json();

    const apiUrl = process.env.NEXT_PUBLIC_API_LOCAL;

    if (!apiUrl) {
      return NextResponse.json(
        { error: "URL do backend não configurada." },
        { status: 500 },
      );
    }

    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/web-push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
      cache: "no-store",
    });

    const texto = await response.text();

    console.log("Backend URL:", response.url);
    console.log("Backend STATUS:", response.status);
    console.log("Backend RESPOSTA:", texto.substring(0, 300));

    let data;

    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      return NextResponse.json(
        { error: `Resposta inválida do backend. HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Erro ao registrar Web Push:", error);

    return NextResponse.json(
      { error: "Erro interno ao registrar Web Push." },
      { status: 500 },
    );
  }
}
