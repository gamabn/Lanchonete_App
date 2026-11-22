import { NextRequest, NextResponse } from "next/server";
import {
  configuredProductError,
  forwardConfiguredWrite,
  productUuid,
} from "../../configuredProxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  if (!productUuid.test(productId))
    return configuredProductError("Id do produto invalido", 400);

  return forwardConfiguredWrite(
    request,
    `/produto/${productId}/active`,
    "PATCH",
  );
}
