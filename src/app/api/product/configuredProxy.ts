import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";

const headers = { "Cache-Control": "no-store" };

export function configuredProductError(error: string, status: number, details?: string[]) {
  return NextResponse.json({ error, details }, { status, headers });
}

export async function forwardConfiguredProduct(
  path: string,
  body?: unknown,
  method: "GET" | "POST" | "PATCH" = body === undefined ? "GET" : "POST",
) {
  const token = (await cookies()).get("token")?.value;
  if (!token) return configuredProductError("Não autenticado.", 401);

  try {
    const response = await api.request({
      method,
      url: path,
      data: body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return NextResponse.json(response.data, { status: response.status, headers });
  } catch (error) {
    const upstream = isAxiosError(error) ? error.response : undefined;
    const status = upstream?.status ?? 502;
    if (status === 401) return configuredProductError("Não autenticado.", status);

    const message = upstream?.data?.error;
    const details = status < 500 && Array.isArray(upstream?.data?.details)
      ? upstream.data.details.filter((detail: unknown): detail is string => typeof detail === "string")
      : undefined;
    return configuredProductError(
      status < 500 && typeof message === "string" ? message : "Não foi possível concluir a operação de produto.",
      status,
      details,
    );
  }
}

export const productUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function forwardConfiguredWrite(request: NextRequest, path: string, method: "POST" | "PATCH") {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return configuredProductError("Origem inválida.", 403);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return configuredProductError("Dados de produto inválidos.", 400);
  }
  return forwardConfiguredProduct(path, body, method);
}
