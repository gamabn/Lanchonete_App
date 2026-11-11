import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredWrite, productUuid } from "../../configuredProxy";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
  const { optionId } = await params;
  if (!productUuid.test(optionId)) {
    return configuredProductError("ID do ingrediente inválido.", 400);
  }
  return forwardConfiguredWrite(request, `/product-options/${optionId}`, "PATCH");
}
