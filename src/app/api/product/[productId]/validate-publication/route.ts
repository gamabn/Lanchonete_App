import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredProduct, productUuid } from "../../configuredProxy";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!productUuid.test(productId)) return configuredProductError("ID do produto inválido.", 400);
  return forwardConfiguredProduct(`/products/${productId}/validate-publication`);
}
