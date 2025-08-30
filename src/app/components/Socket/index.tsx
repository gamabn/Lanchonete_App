import { io } from "socket.io-client";

const BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_API_RENDER
    : process.env.NEXT_PUBLIC_API_URL;

const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
});

export default socket;
