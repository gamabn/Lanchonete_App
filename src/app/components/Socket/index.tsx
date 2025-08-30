import { io } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_RENDER || "https://backend-lanchonete.onrender.com";

const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
});

export default socket;

//https://backend-lanchonete.onrender.com