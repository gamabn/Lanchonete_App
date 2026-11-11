import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredProduct } from "../configuredProxy";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return configuredProductError("Origem inválida.", 403);
  }

  const body = await request.json().catch(() => null);
  const templateSlug = body?.templateSlug;
  if (typeof templateSlug !== "string" || !templateSlug.trim()) {
    return configuredProductError("Informe um modelo válido.", 400);
  }

  return forwardConfiguredProduct("/products/from-template", { templateSlug: templateSlug.trim() });
}
