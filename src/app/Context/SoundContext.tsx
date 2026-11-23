"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface SoundContextData {
  soundEnabled: boolean;
  activateSound: () => Promise<void>;
  playOrderSound: () => Promise<void>;
  playMessageSound: () => Promise<void>;
}

const SoundContext = createContext<SoundContextData | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);

  const orderAudio = useRef<HTMLAudioElement | null>(null);
  const messageAudio = useRef<HTMLAudioElement | null>(null);

  const getOrderAudio = () => {
    if (!orderAudio.current) {
      orderAudio.current = new Audio("/audio/Best-sms.mp3");
    }
    return orderAudio.current;
  };

  const getMessageAudio = () => {
    if (!messageAudio.current) {
      messageAudio.current = new Audio("/audio/sino.mp3");
    }
    return messageAudio.current;
  };

  const activateSound = useCallback(async () => {
    try {
      const order = getOrderAudio();
      const message = getMessageAudio();

      // Testa os dois áudios após interação do usuário.
      await order.play();
      order.pause();
      order.currentTime = 0;

      await message.play();
      message.pause();
      message.currentTime = 0;

      soundEnabledRef.current = true;
      setSoundEnabled(true);

      console.log("🔔 Sons de pedidos e mensagens ativados!");
    } catch (error) {
      console.error("Erro ao ativar sons:", error);
      soundEnabledRef.current = false;
      setSoundEnabled(false);
    }
  }, []);

  const playOrderSound = useCallback(async () => {
    if (!soundEnabledRef.current) return;

    try {
      const audio = getOrderAudio();
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn("Erro ao reproduzir som de pedido:", error);
    }
  }, []);

  const playMessageSound = useCallback(async () => {
    if (!soundEnabledRef.current) return;

    try {
      const audio = getMessageAudio();
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.warn("Erro ao reproduzir som de mensagem:", error);
    }
  }, []);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        activateSound,
        playOrderSound,
        playMessageSound,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);

  if (!context) {
    throw new Error("useSound deve ser usado dentro de SoundProvider");
  }

  return context;
}
