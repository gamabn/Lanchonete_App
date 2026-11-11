import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredWrite, productUuid } from "../../configuredProxy";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!productUuid.test(productId)) return configuredProductError("ID do produto inválido.", 400);
  return forwardConfiguredWrite(request, `/products/${productId}/publish`, "PATCH");
}
