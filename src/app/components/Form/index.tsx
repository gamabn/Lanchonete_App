"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useRef, useState } from "react";
import { Context } from "@/app/Context";

export function LoginForm() {
  const router = useRouter();
  const { login } = useContext(Context);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    try {
      setLoading(true);
      setError("");

      const email = e.currentTarget.email.value;
      const password = e.currentTarget.password.value;

      await login(email, password);
      // Refresh clears prefetched routes from the previous session. The Context
      // has already been validated; refresh alone does not update client state.
      router.refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error && err.name !== "TimeoutError"
        ? err.message : "O login demorou demais. Tente novamente.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full flex flex-col h-screen gap-4 text-black"
    >
      <div className="flex flex-col gap-2">
        <label>Email</label>
        <input
          type="email"
          name="email"
          required
          className="border p-2 rounded-xl"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label>Senha</label>
        <input
          type="password"
          name="password"
          required
          className="border p-2 rounded-xl"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 p-2 rounded-xl text-white disabled:bg-blue-300"
      >
        {loading ? "Carregando..." : "Entrar"}
      </button>

      {error && <p role="alert" className="text-red-500">{error}</p>}

      <Link href="/auth/cadastro" className="text-blue-800 text-sm text-center">
        Não tem cadastro? Cadastre-se
      </Link>

      <Link href="/auth/email" className="text-blue-800 text-sm text-center">
        Esqueceu a senha?
      </Link>
    </form>
  );
}
