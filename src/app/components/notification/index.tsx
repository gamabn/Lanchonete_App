"use client";

import { MessageCircleMore, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MessageNotification } from "@/app/util/ordersSocket";
import { useSound } from "@/app/Context/SoundContext";
//import socket from "@/app/components/Socket";

export function Notification() {
  const [message, setMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);

  const { playMessageSound } = useSound();

  // Ativa o áudio após interação do usuário
  async function enableSound() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext.current) {
        audioContext.current = new AudioContextClass();
      }

      await audioContext.current.resume();
      setSoundEnabled(true);
    } catch (error) {
      console.error("Erro ao ativar som:", error);
    }
  }

  // Reproduz um toque curto
  function playNotificationSound() {
    const context = audioContext.current;

    if (!context || context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);

    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.26);
  }

  useEffect(() => {
    function handleNewMessage(event: Event) {
      const notification = (event as CustomEvent<MessageNotification>).detail;

      if (!notification) return;

      setMessage(`${notification.sender_name}: ${notification.message}`);

      // playNotificationSound();
      void playMessageSound();
    }

    window.addEventListener("dashboard:new-message", handleNewMessage);

    return () => {
      window.removeEventListener("dashboard:new-message", handleNewMessage);
    };
  }, []);

  // Esconde a notificação após 5 segundos
  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <>
      {/*    <button
        onClick={enableSound}
        className="fixed right-5 top-20 z-50 rounded-lg border bg-gray-800 p-2 text-white"
        title={soundEnabled ? "Som ativado" : "Ativar som"}
      >
        {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
      </button>  */}

      {message && (
        <div className="fixed right-5 top-32 z-50 rounded-lg border bg-gray-800/95 p-3 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <MessageCircleMore size={24} />
            <span>Nova mensagem</span>
          </div>

          <p className="mt-2 text-sm">{message}</p>
        </div>
      )}
    </>
  );
}
