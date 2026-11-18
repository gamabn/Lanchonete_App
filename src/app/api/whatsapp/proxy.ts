import "server-only";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";
import {
  parseWhatsAppSnapshot,
  safeWhatsAppCode,
  whatsappErrorMessage,
} from "@/app/util/whatsappTypes";

const headers = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function whatsappProxy(
  request: NextRequest,
  action: string,
  method: "GET" | "POST",
) {
  const allowed =
    method === "GET" ? ["status", "qr"] : ["connect", "disconnect"];
  if (!allowed.includes(action))
    return NextResponse.json(
      { message: "Rota indisponível" },
      { status: 404, headers },
    );
  if (
    method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Origem inválida" },
      { status: 403, headers },
    );
  const token = (await cookies()).get("token")?.value;
  if (!token)
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: whatsappErrorMessage("UNAUTHORIZED") },
      { status: 401, headers },
    );
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  };
  try {
    if (action === "qr") {
      // Bind QR and tenant using the SAME server-held cookie snapshot. Never decode/expose the JWT.
      const status = parseWhatsAppSnapshot(
        (
          await api.request({
            ...config,
            method: "GET",
            url: "/whatsapp/status",
          })
        ).data,
      );
      if (status.status !== "qr_required" || !status.qr_available)
        return NextResponse.json(
          { restaurant_id: status.restaurant_id, qr: null, expires_at: null },
          { headers },
        );
      const raw: unknown = (
        await api.request({ ...config, method: "GET", url: "/whatsapp/qr" })
      ).data;
      const qr = raw as { qr?: unknown; expires_at?: unknown } | null;
      if (qr?.qr == null)
        return NextResponse.json(
          { restaurant_id: status.restaurant_id, qr: null, expires_at: null },
          { headers },
        );
      if (
        typeof qr.qr !== "string" ||
        !qr.qr.length ||
        qr.qr.length > 4096 ||
        typeof qr.expires_at !== "string" ||
        !Number.isFinite(Date.parse(qr.expires_at))
      )
        throw new Error("Invalid QR response");
      return NextResponse.json(
        {
          restaurant_id: status.restaurant_id,
          qr: qr.qr,
          expires_at: qr.expires_at,
        },
        { headers },
      );
    }
    const response = await api.request({
      ...config,
      url: `/whatsapp/${action}`,
      method,
      ...(method === "POST" ? { data: {} } : {}),
    });
    return NextResponse.json(parseWhatsAppSnapshot(response.data), {
      status: action === "connect" ? 202 : 200,
      headers,
    });
  } catch (error) {
    const upstream = isAxiosError(error) ? error.response?.status : undefined;
    const status =
      upstream && [401, 403, 409, 503].includes(upstream) ? upstream : 503;
    const code =
      status === 401
        ? "UNAUTHORIZED"
        : upstream === 404
          ? "WHATSAPP_ROUTE_UNAVAILABLE"
          : isAxiosError(error)
            ? error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
              ? "WHATSAPP_TIMEOUT"
              : !error.response
                ? "WHATSAPP_BACKEND_UNREACHABLE"
                : safeWhatsAppCode(error.response.data?.error)
            : "INVALID_WHATSAPP_RESPONSE";
    return NextResponse.json(
      { error: code, message: whatsappErrorMessage(code) },
      { status, headers },
    );
  }
}
