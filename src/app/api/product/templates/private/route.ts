import type { NextRequest } from "next/server";
import { forwardConfiguredProduct, forwardConfiguredWrite } from "../../configuredProxy";
export function GET() { return forwardConfiguredProduct("/products/templates/private"); }
export function POST(request: NextRequest) { return forwardConfiguredWrite(request, "/products/templates/private", "POST"); }
