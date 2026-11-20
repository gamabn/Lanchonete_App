"use client";
import { useState, useEffect } from "react";
type IncricaoPush = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function converterChaveVapid(chave: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (chave.length % 4)) % 4);

  const base64 = (chave + padding).replace(/-/g, "+").replace(/_/g, "/");

  const dados = atob(base64);

  const bytes = new Uint8Array(new ArrayBuffer(dados.length));

  for (let i = 0; i < dados.length; i++) {
    bytes[i] = dados.charCodeAt(i);
  }

  return bytes;
}

export function AtivarWebPush() {
  const [mensagem, setMensagem] = useState("");
  const [inscricao, setInscricao] = useState<IncricaoPush | null>(null);
  const [ativado, setAtivado] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      void ativar();
    }
  }, []);

  async function ativar() {
    try {
      setMensagem("Registrando web Push ...");
      const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!chavePublica) {
        throw new Error("Chave publica VAPID nao encontrada");
      }

      const permissao =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permissao !== "granted") {
        throw new Error("Permissão de notificações não concedida.");
      }

      if (permissao !== "granted") {
        throw new Error("Permissão de notificações não concedida.");
      }

      const registro = await navigator.serviceWorker.register("/vapid-sw.js", {
        //  scope: "/",
        scope: "/vapid-teste/",
      });

      const existente = await registro.pushManager.getSubscription();

      const subscription =
        existente ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: converterChaveVapid(chavePublica),
        }));

      const dados = subscription.toJSON();

      if (!dados.endpoint || !dados.keys?.p256dh || !dados.keys?.auth) {
        throw new Error("Inscrição push incompleta.");
      }

      setInscricao({
        endpoint: dados.endpoint,
        keys: {
          p256dh: dados.keys.p256dh,
          auth: dados.keys.auth,
        },
      });

      const response = await fetch("/api/web-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: dados.endpoint,
          keys: {
            p256dh: dados.keys.p256dh,
            auth: dados.keys.auth,
          },
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.error || "Erro ao salvar inscrição Web Push.",
        );
      }

      // console.log("✅ Inscrição salva no PostgreSQL:", resultado);

      setMensagem("✅ Web Push ativado e salvo no banco!");

      //  console.log("🔔 INSCRIÇÃO WEB PUSH:", JSON.stringify(dados));

      setAtivado(true);
      setMensagem("✅ Web Push registrado com sucesso!");

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Erro Web Push:", error);

      setMensagem(error instanceof Error ? error.message : "Erro desconhecido");
    }
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {!ativado && Notification.permission !== "granted" && (
        <button
          type="button"
          onClick={ativar}
          className="rounded-lg border p-3"
        >
          🔔 Ativar notificações
        </button>
      )}
      {/*}  <p>{mensagem}</p>*/}

      {inscricao && (
        <p className="text-green-500">
          Inscrição criada e pronta para o teste de envio.
        </p>
      )}
    </div>
  );
}
