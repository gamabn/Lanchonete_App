import type { NextRequest } from "next/server";
import { configuredProductError, forwardConfiguredWrite, productUuid } from "../../../../configuredProxy";
export async function POST(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!productUuid.test(templateId)) return configuredProductError("ID do modelo inválido.", 400);
  return forwardConfiguredWrite(request, `/products/templates/private/${templateId}/versions`, "POST");
}
