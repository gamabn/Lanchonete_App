// app/components/GraficButton.tsx
"use client";

import { useState } from "react";
import { getGraficData } from "../actions/grafic";

export default function GraficButton() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setMessage("");
    const res = await getGraficData();
    setLoading(false);

    if (res.success) {
      setMessage(`✅ Dados recebidos: ${res.data.length} registros`);
    } else {
      setMessage(`❌ ${res.error}`);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-blue-500 px-4 py-2 rounded text-white"
      >
        {loading ? "Carregando..." : "Buscar Gráfico"}
      </button>

      {message && (
        <p className="mt-2">{message}</p>
      )}
    </div>
  );
}