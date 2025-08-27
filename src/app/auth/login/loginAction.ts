"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import api from "@/app/util/api";

type ActionState = { message?: string };

export async function handleLogin(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { message: "Por favor, preencha o e-mail e a senha." };
  }

  try {
    const response = await api.post("/auth", { email, password });

    if (!response.data?.token) {
      return { message: "Credenciais inválidas." };
    }

    const maxAgeSeconds = 60 * 60 * 24 * 30; // 30 dias

  
    (await cookies()).set({
      name: "token",
      value: response.data.token,
      maxAge: maxAgeSeconds,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

  } catch (err) {
    console.error(err);
    return { message: "Falha no login. Verifique suas credenciais ou se o servidor está online." };
  }

  redirect("/dashboard");
}
