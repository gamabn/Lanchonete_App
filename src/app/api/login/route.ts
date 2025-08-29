import { NextResponse } from "next/server";
import api from "@/app/util/api";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Preencha email e senha" }, { status: 400 });
    }

    const response = await api.post("/auth", { email, password });

    if (!response.data?.token) {
      return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 });
    }

    const maxAgeSeconds = 60 * 60 * 24 * 30;

    const cookieStore = await cookies();
    cookieStore.set({
      name: "token",
      value: response.data.token,
      maxAge: maxAgeSeconds,
      httpOnly: true,
      secure: process.env.NEXT_PUBLIC_API_RENDER === "production",
      sameSite: "strict",
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ message: "Erro ao fazer login" }, { status: 500 });
  }
}

export async function PATCH(request: Request){
  const cookieStore = await cookies();
  const token =  cookieStore.get("token")?.value;
  const {status} = await request.json();

  if(!token){
    return NextResponse.json({message: "Não autenticado"}, {status: 401})
  }

  try{
    const response = await api.patch(`/user/status`, {status}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data);

  }catch(err){
    return NextResponse.json({message: "Erro ao atualizar status"}, {status: 500})
  }
}
