import axios from "axios";

export const chatCredentialKey = (restaurantId: string) => `chat_credential:${restaurantId}`;
const chatApi = axios.create({ baseURL: "/api/chat" });
chatApi.interceptors.request.use(config => {
  // Explicit credentials belong to the restaurant captured by the caller.
  if (config.headers.has("x-chat-credential")) {
    if (!config.headers.get("x-chat-credential")) config.headers.set("x-chat-credential", "missing-customer-credential");
    return config;
  }
  const match = window.location.pathname.match(/^\/clients\/([^/]+)/);
  if (match) {
    const token = localStorage.getItem(chatCredentialKey(decodeURIComponent(match[1])));
    // Never fall back to a logged-in owner's cookie on public customer pages.
    config.headers.set("x-chat-credential", token || "missing-customer-credential");
  }
  return config;
});
export default chatApi;
