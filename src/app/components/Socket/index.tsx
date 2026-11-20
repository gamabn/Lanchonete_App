import { io } from "socket.io-client";
import { backendUrl } from "@/app/util/backend";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_RENDER;
//const BACKEND_URL = backendUrl;
//const BACKEND_URL = process.env.NEXT_PUBLIC_API_LOCAL;

const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
});

export default socket;

//https://backend-lanchonete.onrender.com
