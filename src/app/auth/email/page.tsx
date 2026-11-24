"use client";
import { Header } from "@/app/components/header";
import { useState } from "react";
import api from "@/app/util/api";
import { Loader } from "lucide-react";

export default function ForgetEmail() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmail() {
    if (!email) return;

    try {
      setLoading(true);
      const response = await api.post("/user/change", {
        email,
      });

      console.log(response.data);
      setEmail("");
      setMessage("Email enviado com sucesso");
      setLoading(false);
    } catch (err: any) {
      console.error("ERRO AO REDEFINIR SENHA:", err);
      console.error("RESPOSTA DO BACKEND:", err.response?.data);
      setMessage(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Erro ao redefinir senha.",
      );

      setLoading(false);
    }
  }
  return (
    <div>
      <Header />
      <h1 className="text-2xl font-bold text-center m-5 max-sm:text-md">
        Digite seu email
      </h1>

      <div className="flex flex-col gap-2 p-3">
        <input
          className="p-2  border rounded-xl w-full "
          type="text"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleEmail}
          className="bg-blue-600 flex items-center justify-center text-white p-2 text-lg rounded-xl"
        >
          {loading ? <Loader size={18} className="animate-ping" /> : "Enviar"}
        </button>
        {message && <p className="text-red-500 text-sm">{message}</p>}
      </div>
    </div>
  );
}
