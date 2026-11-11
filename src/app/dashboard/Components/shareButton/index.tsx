"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      // 📱 Celular (ou navegadores compatíveis)a
      try {
        await navigator.share({
          title: title,
          text: "Agende seu horário aqui:",
          url: url,
        });
      } catch (err) {
        console.log("Erro ao compartilhar:", err);
      }
    } else {
      // 💻 PC fallback → copia link
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="bg-white text-black border border-black px-4 py-2 rounded-lg mt-2 cursor-pointer"
    >
      <h2>Compartilhar Link para o cliente</h2>
      <span className="flex gap-2 items-center justify-center">
        <Share2 size={24} color="#00ff" />
        {copied ? "Link copiado!" : "Compartilhar"}
      </span>
    </button>
  );
}
