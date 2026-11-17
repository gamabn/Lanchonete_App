import { NextRequest } from "next/server";
import { whatsappProxy } from "../proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type RouteContext = { params: Promise<{ action: string }> };
export async function GET(request: NextRequest, context: RouteContext) {
  return whatsappProxy(request, (await context.params).action, "GET");
}
export async function POST(request: NextRequest, context: RouteContext) {
  return whatsappProxy(request, (await context.params).action, "POST");
}
