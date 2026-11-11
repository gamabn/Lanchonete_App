import { io } from "socket.io-client";
import { backendUrl } from "./backend";
import type { VendasProps } from "../models/interface";

export interface OrderStatusUpdate {
  order_id: string;
  status: "pending" | "enviado" | "completed";
  // onReconnect?: () => void
}

export function subscribeOrders(
  restaurantId: string,
  receive: (order: VendasProps) => void,
  onStatusUpdate?: (update: OrderStatusUpdate) => void,
  onReconnect?: () => void,
) {
  if (!backendUrl) return () => {};

  let stopped = false;
  let hasConnected = false;
  let wasDisconnected = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;

  const socket = io(`${backendUrl.replace(/\/$/, "")}/orders`, {
    autoConnect: false,
    forceNew: true,
    transports: ["websocket", "polling"],

    auth: (callback) => {
      pending?.abort();
      pending = new AbortController();

      void fetch("/api/orders/socket-ticket", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.any([pending.signal, AbortSignal.timeout(15000)]),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Não autorizado");

          const data: { ticket: string } = await response.json();

          if (!stopped) callback({ ticket: data.ticket });
        })
        .catch(() => {
          if (!stopped) callback({});
        });
    },
  });

  const reconnect = () => {
    if (stopped) return;

    clearTimeout(retry);

    retry = setTimeout(() => {
      if (!stopped) socket.connect();
    }, 3000);
  };

  // Recebe novos pedidos
  const onOrder = (order: VendasProps) => {
    if (!stopped && order?.restaurant_id === restaurantId) {
      receive(order);
    }
  };

  // Recebe alterações de status
  const onOrderUpdated = (update: OrderStatusUpdate) => {
    if (
      stopped ||
      !update?.order_id ||
      !["pending", "enviado", "completed"].includes(update.status)
    ) {
      return;
    }

    console.log("📡 STATUS RECEBIDO VIA SOCKET:", update);

    onStatusUpdate?.(update);
  };

  const onConnect = () => {
    if (stopped) return;

    console.log("🟢 Socket.IO conectado!");

    console.log("📊 Estado da conexão:", {
      hasConnected,
      wasDisconnected,
      socketId: socket.id,
    });

    if (hasConnected && wasDisconnected) {
      console.log("🔄 Conexão recuperada. Sincronizando pedidos...");
      onReconnect?.();
    }

    hasConnected = true;
    wasDisconnected = false;
  };

  const onDisconnect = () => {
    if (stopped) return;

    console.log("🔴 Socket.IO desconectado!");
    wasDisconnected = true;

    reconnect();
  };

  socket.on("newOrder", onOrder);
  socket.on("orderUpdated", onOrderUpdated);

  // socket.on("connect_error", reconnect);
  //  socket.on("disconnect", reconnect);
  socket.on("connect", onConnect);
  socket.on("connect_error", reconnect);
  socket.on("disconnect", onDisconnect);
  socket.connect();

  return () => {
    stopped = true;

    pending?.abort();
    clearTimeout(retry);

    socket.off("newOrder", onOrder);
    socket.off("orderUpdated", onOrderUpdated);

    //socket.off("connect_error", reconnect);
    // socket.off("disconnect", reconnect);
    socket.off("connect", onConnect);
    socket.off("connect_error", reconnect);
    socket.off("disconnect", onDisconnect);

    socket.disconnect();
  };
}
