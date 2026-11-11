import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";
import api from "@/app/util/api";

// The backend limits the image itself to 5 MiB. Allow room for multipart fields.
const MAX_MULTIPART_BYTES = 5 * 1024 * 1024 + 256 * 1024;

function productError(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

function backendError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const response = error.response;
    const status = response?.status ?? 502;
    if (status === 401) {
      return productError("Não autenticado.", status);
    }

    const message = response?.data?.error ?? response?.data?.message;
    if (status < 500 && typeof message === "string" && message) {
      return productError(message, status);
    }

    return productError("Erro ao se comunicar com o backend de produtos.", status);
  }

  return productError("Erro interno ao processar o produto.", 500);
}

async function forwardMultipart(request: NextRequest, method: "POST" | "PUT") {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return productError("Não autenticado.", 401);
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    return productError("Envio de produto inválido. Use multipart/form-data.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      length += value.byteLength;
      if (length > MAX_MULTIPART_BYTES) {
        await reader.cancel().catch(() => undefined);
        return productError("O envio excede o tamanho permitido. A imagem deve ter até 5 MiB.", 413);
      }
      chunks.push(value);
    }
  } catch {
    return productError("Não foi possível ler o envio do produto.", 400);
  } finally {
    reader.releaseLock();
  }

  try {
    const response = await api.request({
      method,
      url: method === "POST" ? "/product" : "/product/edit",
      data: Buffer.concat(chunks, length),
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${token}`,
      },
    });
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    return backendError(error);
  }
}

export function POST(request: NextRequest) {
  return forwardMultipart(request, "POST");
}

export function PUT(request: NextRequest) {
  return forwardMultipart(request, "PUT");
}

export async function GET(request: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return productError("Não autenticado.", 401);
  }

  try {
    const path = request.nextUrl.searchParams.get("configured") === "true" ? "/product?configured=true" : "/product";
    const response = await api.get(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    return backendError(error);
  }
}
