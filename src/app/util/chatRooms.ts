import type { Socket } from "socket.io-client";
import chatApi from "./chatApi";

type Membership = { timer?: ReturnType<typeof setTimeout> };
const active = new WeakMap<Socket, Map<string, Membership>>();
export function leaveChat(socket: Socket, id: string) {
  const rooms = active.get(socket);
  clearTimeout(rooms?.get(id)?.timer);
  rooms?.delete(id);
  socket.emit("leaveRoom", id);
}
export function joinChat(socket: Socket, id: string, onReady?: () => void) {
  leaveChat(socket, id);
  let rooms = active.get(socket);
  if (!rooms) { rooms = new Map(); active.set(socket, rooms); }
  const registry = rooms;
  const membership: Membership = {};
  registry.set(id, membership);
  async function renew() {
    try {
      const response = await chatApi.post<{ ticket: string }>("/chat/socket-ticket", { chat_id: id });
      if (registry.get(id) !== membership) return;
      socket.emit("joinRoom", { ticket: response.data.ticket }, (result: { ok: boolean }) => {
        if (result.ok && registry.get(id) === membership) onReady?.();
      });
      membership.timer = setTimeout(() => { void renew(); }, 240000);
    } catch {
      if (registry.get(id) === membership) membership.timer = setTimeout(() => { void renew(); }, 10000);
    }
  }
  void renew();
}
