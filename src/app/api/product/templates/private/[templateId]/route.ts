import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredProduct, forwardConfiguredWrite, productUuid } from "../../../configuredProxy";
type Context = { params: Promise<{ templateId: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  const { templateId } = await params;
  if (!productUuid.test(templateId)) return configuredProductError("ID do modelo inválido.", 400);
  return forwardConfiguredProduct(`/products/templates/private/${templateId}`);
}
async function write(request: NextRequest, { params }: Context, method: "PATCH" | "DELETE") {
  const { templateId } = await params;
  if (!productUuid.test(templateId)) return configuredProductError("ID do modelo inválido.", 400);
  return forwardConfiguredWrite(request, `/products/templates/private/${templateId}`, method);
}
export function PATCH(request: NextRequest, context: Context) { return write(request, context, "PATCH"); }
export function DELETE(request: NextRequest, context: Context) { return write(request, context, "DELETE"); }
