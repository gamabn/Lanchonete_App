import { forwardConfiguredProduct } from "../configuredProxy";

export function GET() {
  return forwardConfiguredProduct("/product-templates");
}
