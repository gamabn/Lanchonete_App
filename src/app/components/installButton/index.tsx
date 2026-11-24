"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Smartphone, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

let savedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    console.log("🔥 beforeinstallprompt DISPAROU no navegador");
    e.preventDefault();
    savedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });
}

function subscribePrompt(callback: () => void) {
  promptListeners.add(callback);
  return () => {
    promptListeners.delete(callback);
  };
}

function getPromptSnapshot() {
  return savedPrompt;
}

function getPromptServerSnapshot() {
  return null;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia("(display-mode: standalone)");

  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (window.navigator as unknown as { standalone?: boolean }).standalone,
    )
  );
}

function getStandaloneServerSnapshot() {
  return false;
}

export function InstallAppButton() {
  const [showInstructions, setShowInstructions] = useState(false);

  const installPrompt = useSyncExternalStore(
    subscribePrompt,
    getPromptSnapshot,
    getPromptServerSnapshot,
  );

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot,
  );

  // Se o usuário já está usando o aplicativo instalado, não precisa mostrar o botão
  if (isStandalone) {
    return null;
  }

  async function handleInstall() {
    if (installPrompt) {
      // 1. Se o navegador já liberou o prompt nativo do Chrome/Android
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      console.log("Resultado da instalação:", result.outcome);

      if (result.outcome === "accepted") {
        savedPrompt = null;
        promptListeners.forEach((listener) => listener());
      }
    } else {
      // 2. Se o navegador ainda não disparou o prompt nativo ou for iPhone/Safari/Desktop
      setShowInstructions(true);
    }
  }

  const isIOS =
    typeof window !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  return (
    <>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center w-lg max-sm:w-sm justify-center gap-2 rounded-lg bg-black px-4 py-2 font-semibold text-white shadow-lg hover:bg-neutral-800 transition-all cursor-pointer text-sm my-2"
        >
          <Download size={18} className="text-amber-400" />
          <span>Instalar aplicativo</span>
        </button>
      </div>

      {/* Modal explicativo caso o prompt nativo não esteja disponível no momento */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl text-black">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black p-1 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  Instalar Barbearia Fabinho
                </h3>
                <p className="text-xs text-gray-500">
                  Acesso rápido direto na sua tela inicial
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="text-sm text-gray-700 space-y-3">
                <p className="font-medium text-black">No iPhone / iPad:</p>
                <ol className="list-decimal list-inside space-y-2 text-xs">
                  <li className="flex items-center gap-1">
                    1. Toque no botão de <strong>Compartilhar</strong>{" "}
                    <Share size={14} className="inline text-blue-500" /> (na
                    barra inferior do Safari).
                  </li>
                  <li>
                    2. Role para baixo e selecione{" "}
                    <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>
                    3. Confirme clicando em <strong>Adicionar</strong> no canto
                    superior.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="text-sm text-gray-700 space-y-3">
                <p className="font-medium text-black">
                  No Android ou Computador:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-xs">
                  <li>
                    1. Toque nos <strong>3 pontinhos (⋮)</strong> no canto
                    superior do navegador.
                  </li>
                  <li>
                    2. Selecione a opção{" "}
                    <strong>&quot;Instalar aplicativo&quot;</strong> ou{" "}
                    <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                  </li>
                  <li>3. Confirme a instalação.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="mt-6 w-full rounded-lg bg-black py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
