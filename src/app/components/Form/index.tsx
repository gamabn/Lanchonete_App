"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = e.currentTarget.email.value;
    const password = e.currentTarget.password.value;

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    setLoading(false);

    if (res.ok) {
      // Redireciona direto para o dashboard
     //router.replace("/dashboard"); // ainda SPA, mas substitui o histórico
     window.location.href = "/dashboard"; // força request completo -> middleware executa
    } else {
      const data = await res.json();
      alert(data.message || "Erro no login");
    }
   
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 text-black">
      <div className="flex flex-col gap-2">
        <label>Email</label>
        <input type="email" name="email" required className="border p-2 rounded-xl"/>
      </div>

      <div className="flex flex-col gap-2">
        <label>Senha</label>
        <input type="password" name="password" required className="border p-2 rounded-xl"/>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 p-2 rounded-xl text-white disabled:bg-blue-300"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {error && <p className="text-red-500">{error}</p>}

      <Link href="/auth/cadastro" className="text-blue-800 text-sm text-center">
        Não tem cadastro? Cadastre-se
      </Link>

      <Link href="/auth/email" className="text-blue-800 text-sm text-center">
      Esqueceu a senha?
      </Link>
    </form>
  );
}
