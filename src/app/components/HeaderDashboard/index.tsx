"use client";

import Link from "next/link";
import { useState, useEffect, useContext } from "react";
import { FiLogOut, FiShoppingBag } from "react-icons/fi";
import {
  ChartNoAxesCombined,
  MessageCircleMore,
  FilePenLine,
  AlignJustify,
  House,
  UserRound,
  Smartphone,
  X,
} from "lucide-react";

import { Context } from "@/app/Context";
import socket from "@/app/components/Socket";

export function HeaderDashboard({ children }: { children: React.ReactNode }) {
  const { lanchoneteProfile, logout } = useContext(Context);

  const [active, setActive] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Busca o status da lanchonete quando o perfil estiver disponível
  useEffect(() => {
    if (!lanchoneteProfile?.id) return;

    let mounted = true;

    async function getStore() {
      try {
        const res = await fetch(`/api/store/${lanchoneteProfile?.id}`);

        if (!res.ok) {
          throw new Error("Erro ao buscar status da lanchonete.");
        }

        const data = await res.json();

        if (mounted) {
          setIsOpen(data.status);
        }
      } catch (error) {
        console.error("Erro ao buscar loja:", error);
      }
    }

    getStore();

    return () => {
      mounted = false;
    };
  }, [lanchoneteProfile?.id]);

  // Atualização do status recebida pelo Socket.IO
  useEffect(() => {
    function handleStatusUpdated(data: { status: boolean }) {
      setIsOpen(data.status);
    }

    socket.on("statusUpdated", handleStatusUpdated);

    return () => {
      socket.off("statusUpdated", handleStatusUpdated);
    };
  }, []);

  // Alternar status da lanchonete
  async function handleSwitch() {
    if (updatingStatus) return;

    const novoStatus = !isOpen;

    setUpdatingStatus(true);
    setIsOpen(novoStatus);

    try {
      const res = await fetch("/api/login", {
        method: "PATCH",
        body: JSON.stringify({ status: novoStatus }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Não foi possível atualizar o status.");
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setIsOpen(!novoStatus);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function closeMenu() {
    setActive(false);
  }

  const menuItems = [
    {
      href: "/dashboard",
      label: "Início",
      icon: <House size={30} />,
    },
    {
      href: "/dashboard/product",
      label: "Produtos",
      icon: <FiShoppingBag size={30} />,
    },
    {
      href: "/dashboard/financas",
      label: "Finanças",
      icon: <ChartNoAxesCombined size={30} />,
    },
    {
      href: "/dashboard/message",
      label: "Mensagens",
      icon: <MessageCircleMore size={30} />,
    },
    {
      href: "/dashboard/profile",
      label: "Perfil",
      icon: <UserRound size={30} />,
    },
    {
      href: "/dashboard/whatsapp",
      label: "WhatsApp",
      icon: <Smartphone size={30} />,
    },
    {
      href: "/dashboard/editProduct",
      label: "Editar produtos",
      icon: <FilePenLine size={30} />,
    },
  ];

  return (
    <div className="flex flex-col  min-h-screen w-full overflow-hidden">
      {/* HEADER */}
      <header className="relative z-30 w-full h-20 shrink-0 bg-orange-600 shadow-sm px-3">
        <div className="w-full h-full flex items-center justify-between max-w-7xl mx-auto gap-3">
          {/* Logo, menu e nome da lanchonete */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setActive(true)}
              aria-label="Abrir menu lateral"
              aria-expanded={active}
              className="h-10 w-10 shrink-0 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition"
            >
              <AlignJustify size={25} color="#ef8300" />
            </button>

            {lanchoneteProfile?.image_url && (
              <img
                src={lanchoneteProfile.image_url}
                alt="Logo da lanchonete"
                className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-white"
              />
            )}

            <h1
              title={lanchoneteProfile?.name || ""}
              className="text-white text-base sm:text-xl md:text-2xl font-bold truncate min-w-0"
            >
              {lanchoneteProfile?.name}
            </h1>
          </div>

          {/* Status e logout */}
          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            <label className="inline-flex items-center cursor-pointer gap-2">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isOpen}
                disabled={updatingStatus}
                onChange={handleSwitch}
              />

              <div
                className="relative w-11 h-6 bg-gray-200 rounded-full peer
                peer-focus:ring-4 peer-focus:ring-blue-300
                after:content-[''] after:absolute after:top-[2px]
                after:start-[2px] after:bg-white after:border
                after:border-gray-300 after:rounded-full
                after:h-5 after:w-5 after:transition-all
                peer-checked:bg-blue-600
                peer-checked:after:translate-x-full"
              />

              <span className="text-xs sm:text-sm font-medium text-white">
                {isOpen ? "Aberto" : "Fechado"}
              </span>
            </label>

            <button
              type="button"
              onClick={() => logout()}
              aria-label="Sair"
              title="Sair"
              className="flex bg-black hover:bg-gray-700 rounded-full p-2 items-center justify-center transition"
            >
              <FiLogOut size={25} color="red" />
            </button>
          </div>
        </div>
      </header>

      {/* FUNDO ESCURO DO MENU */}
      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          active
            ? "opacity-100 visible"
            : "opacity-0 invisible pointer-events-none"
        }`}
      />

      {/* MENU LATERAL */}
      <aside
        aria-label="Menu de navegação"
        aria-hidden={!active}
        className={`fixed top-0 left-0 z-50 h-screen
        w-25 md:w-[120px] bg-black text-white
        shadow-xl transform transition-transform duration-300 ease-in-out
        ${active ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full w-full flex flex-col items-center py-5 overflow-y-auto">
          {/* Botão fechar */}
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Fechar menu"
            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 transition mb-6"
          >
            <X size={27} color="#ef8300" />
          </button>

          {/* Logo */}
          {lanchoneteProfile?.image_url && (
            <img
              src={lanchoneteProfile.image_url}
              alt="Logo da lanchonete"
              className="h-10 w-10 rounded-full object-cover mb-6"
            />
          )}

          {/* Navegação */}
          <nav className="w-full flex flex-col items-center gap-6">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                onClick={closeMenu}
                className="w-full flex items-center justify-center text-white hover:text-orange-500 transition"
              >
                {item.icon}
              </Link>
            ))}
          </nav>

          {/* Status da lanchonete */}
          <div className="mt-auto flex flex-col items-center gap-2 pb-5">
            <button
              type="button"
              onClick={handleSwitch}
              disabled={updatingStatus}
              title={isOpen ? "Fechar lanchonete" : "Abrir lanchonete"}
              className={`w-11 h-6 rounded-full relative transition ${
                isOpen ? "bg-blue-600" : "bg-gray-500"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  isOpen ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>

            <span className="text-xs text-white">
              {isOpen ? "Aberto" : "Fechado"}
            </span>

            <button
              type="button"
              onClick={() => logout()}
              title="Sair"
              aria-label="Sair"
              className="mt-3 hover:text-orange-500 transition"
            >
              <FiLogOut size={30} color="#ef8300" />
            </button>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO DO DASHBOARD */}
      <main className="flex-1 min-w-0 py-3">{children}</main>
    </div>
  );
}
