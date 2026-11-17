import type { NextRequest } from "next/server";
import { forwardConfiguredWrite } from "../configuredProxy";
export function POST(request: NextRequest) { return forwardConfiguredWrite(request, "/products/from-private-template", "POST"); }
