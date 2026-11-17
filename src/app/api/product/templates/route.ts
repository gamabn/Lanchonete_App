import { forwardConfiguredProduct } from "../configuredProxy";

export function GET() {
  return forwardConfiguredProduct("/products/templates");
}
