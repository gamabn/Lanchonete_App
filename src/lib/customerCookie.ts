// Shared only by server route handlers. No credential is exposed to browser code.
export function customerCookieName(id: string) {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}gama_customer_${encodeURIComponent(id)}`;
}
