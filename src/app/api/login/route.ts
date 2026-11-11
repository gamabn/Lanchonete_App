import { NextResponse } from "next/server";
import api from "@/app/util/api";
import { isAxiosError } from "axios";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Preencha email e senha" },
        { status: 400 },
      );
    }

    const response = await api.post("/auth", { email, password }, { timeout: 10000 });

    if (!response.data?.token) {
      return NextResponse.json(
        { message: "Credenciais inválidas" },
        { status: 401 },
      );
    }

    const maxAgeSeconds = 60 * 60 * 24 * 30;

    const res = NextResponse.json({ success: true });

    res.cookies.set("token", response.data.token, {
      httpOnly: true,
      path: "/",
      maxAge: maxAgeSeconds,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    const status = isAxiosError(err) ? err.response?.status : undefined;
    // The existing backend uses 400 for invalid credentials.
    const invalidCredentials = status === 400 || status === 401 || status === 403;
    return NextResponse.json(
      { message: invalidCredentials ? "Email ou senha inválidos." : "Serviço de login indisponível. Tente novamente." },
      { status: invalidCredentials ? 401 : 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const { status } = await request.json();

  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  try {
    const response = await api.patch(
      `/user/status`,
      { status },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return NextResponse.json(response.data);
  } catch (err) {
    return NextResponse.json(
      { message: "Erro ao atualizar status" },
      { status: 500 },
    );
  }
}
