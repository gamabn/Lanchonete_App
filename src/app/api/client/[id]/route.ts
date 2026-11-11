import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CustomerSessionError, customerSessionFailure, missingCustomerSession, readCustomerSession,
} from "@/lib/customerSession";
import api from "@/app/util/api";
import { customerCookieName } from "@/lib/customerCookie";

type Context = { params: Promise<{ id: string }> };
interface Customer {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  city: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
}
const headers = { "Cache-Control": "no-store" };
const lifetime = 60 * 60 * 24 * 30;
const cookieOptions = () => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
  path: "/", maxAge: lifetime,
});
function publicCustomer(customer: Customer) {
  const { id, restaurant_id, name, phone, city, street, number, neighborhood, complement } = customer;
  return { id, restaurant_id, name, phone, city, street, number, neighborhood, complement };
}
function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const token = (await cookies()).get(customerCookieName(id))?.value;
  if (!token) return missingCustomerSession();
  try {
    const phone = request.nextUrl.searchParams.get("phone");
    const response = await api.get<Customer[]>(`/client/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }, params: phone ? { phone } : undefined, timeout: 10000,
    });
    if (!Array.isArray(response.data) || response.data.some(customer => customer.restaurant_id !== id)) throw new Error("Cadastro incompatível");
    return NextResponse.json(response.data.map(publicCustomer), { headers });
  } catch (error) { return customerSessionFailure(error); }
}
export async function POST(request: NextRequest, context: Context) {
  if (!sameOrigin(request)) return customerSessionFailure(new CustomerSessionError("CUSTOMER_FORBIDDEN", 403, "Origem inválida."));
  const { id } = await context.params;
  try {
    const existingToken = (await cookies()).get(customerCookieName(id))?.value;
    if (existingToken) {
      await readCustomerSession(existingToken, id);
      throw new CustomerSessionError("SESSION_EXISTS", 409, "Já existe uma sessão. Confirme o cliente ou encerre a sessão antes de criar outro cadastro.");
    }
    const response = await api.post<Customer & { customer_credential: string }>(`/client/${encodeURIComponent(id)}`, await request.json(), { timeout: 10000 });
    if (typeof response.data.customer_credential !== "string" || !response.data.customer_credential || response.data.restaurant_id !== id) {
      throw new Error("Cadastro sem credencial válida");
    }
    const result = NextResponse.json(publicCustomer(response.data), { status: 201, headers });
    result.cookies.set(customerCookieName(id), response.data.customer_credential, cookieOptions());
    return result;
  } catch (error) { return customerSessionFailure(error); }
}
export async function PUT(request: NextRequest, context: Context) {
  if (!sameOrigin(request)) return customerSessionFailure(new CustomerSessionError("CUSTOMER_FORBIDDEN", 403, "Origem inválida."));
  const { id } = await context.params;
  const token = (await cookies()).get(customerCookieName(id))?.value;
  if (!token) return missingCustomerSession();
  try {
    const body = await request.json();
    const expected = request.headers.get("x-customer-id");
    if (expected) {
      const current = await readCustomerSession(token, id, expected);
      if (body?.name !== current.name || body?.phone !== current.phone) {
        throw new CustomerSessionError("CUSTOMER_IDENTITY_CHANGED", 409, "Para trocar de pessoa, encerre a sessão atual.");
      }
    }
    const response = await api.put<Customer>("/client/update", body, {
      headers: { Authorization: `Bearer ${token}`, "X-Customer-Restaurant": id }, timeout: 10000,
    });
    if (response.data.restaurant_id !== id) throw new Error("Cadastro incompatível");
    return NextResponse.json(publicCustomer(response.data), { headers });
  } catch (error) { return customerSessionFailure(error); }
}

// Browser logout only. Issued JWTs retain their original lifetime.
export async function DELETE(request: NextRequest, context: Context) {
  if (!sameOrigin(request)) return customerSessionFailure(new CustomerSessionError("CUSTOMER_FORBIDDEN", 403, "Origem inválida."));
  const { id } = await context.params;
  const response = NextResponse.json({ loggedOut: true }, { headers });
  response.cookies.set(customerCookieName(id), "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
