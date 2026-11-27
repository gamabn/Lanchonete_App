"use client";

import { useState, useContext } from "react";
import { Loader } from "lucide-react";

interface EmailProps {
  email: string;
}

export default function Expired({ email }: EmailProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function Payment() {
    if (loading) return;

    if (!email) {
      setError("Não foi possível identificar o email da lanchonete.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/payment", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Não foi possível iniciar o pagamento.",
        );
      }

      if (!data.url) {
        throw new Error("URL de pagamento não encontrada.");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Erro ao iniciar pagamento:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao iniciar pagamento.",
      );

      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-black p-3 flex flex-col items-center justify-center text-white">
      <h1 className="text-red-500 text-2xl mb-5">Plano expirado</h1>

      <p className="text-sm font-light p-2">Renove sua assinatura.</p>

      <p className="text-xl font-semibold my-4">R$ 49,90</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={Payment}
        disabled={loading}
        className="bg-blue-500 p-3 rounded-lg cursor-pointer hover:bg-blue-800 text-sm disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader size={18} className="animate-spin" />
            Preparando pagamento...
          </span>
        ) : (
          "Renovar Plano"
        )}
      </button>
    </div>
  );
}
