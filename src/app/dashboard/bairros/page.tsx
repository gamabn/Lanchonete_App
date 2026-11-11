"use client";

import { useState } from "react";
import { MapPin, PlusCircle, Pencil, Truck } from "lucide-react";

import { BairrosComponente } from "@/app/components/criar-bairros";
import { BairroEdit } from "@/app/components/editar-bairros";

type Aba = "cadastrar" | "editar";

export default function Bairros() {
  const [active, setActive] = useState<Aba>("cadastrar");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Truck size={17} />
            <span>Gerenciamento de entregas</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bairros e taxas de entrega
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Cadastre os bairros atendidos pela sua lanchonete e gerencie os
            valores das entregas.
          </p>
        </header>

        {/* NAVEGAÇÃO */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActive("cadastrar")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                active === "cadastrar"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <PlusCircle size={18} />
              <span>Cadastrar bairro</span>
            </button>

            <button
              type="button"
              onClick={() => setActive("editar")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                active === "editar"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Pencil size={18} />
              <span>Editar bairros</span>
            </button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div>
          {active === "cadastrar" ? <BairrosComponente /> : <BairroEdit />}
        </div>
      </div>
    </main>
  );
}
