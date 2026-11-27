import axios from "axios";
import { backendUrl } from "./backend";

const api = axios.create({
  baseURL: backendUrl,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const reason = error.response?.data?.reason;

    console.log("ERRO AXIOS:", {
      status,
      reason,
      url: error.config?.url,
    });

    if (typeof window !== "undefined") {
      if (status === 401) {
        window.location.href = "/login";
      }

      if (
        status === 403 &&
        [
          "trial_expired",
          "payment_expired",
          "inactive",
          "no_subscription",
        ].includes(reason)
      ) {
        if (window.location.pathname !== "/expired") {
          window.location.href = "/expired";
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
