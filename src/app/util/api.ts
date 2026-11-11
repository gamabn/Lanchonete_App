import axios from "axios";
import { backendUrl } from "./backend";

const api = axios.create({
  baseURL: backendUrl,
});

export default api;
