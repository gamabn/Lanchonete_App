import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredProduct, forwardConfiguredWrite, productUuid } from "../../configuredProxy";

type Context = { params: Promise<{ productId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { productId } = await params;
  if (!productUuid.test(productId)) {
    return configuredProductError("ID do produto inválido.", 400);
  }
  return forwardConfiguredProduct(`/products/${productId}/admin-configuration`);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { productId } = await params;
  if (!productUuid.test(productId)) {
    return configuredProductError("ID do produto inválido.", 400);
  }
  return forwardConfiguredWrite(request, `/products/${productId}/admin-configuration`, "PATCH");
}
