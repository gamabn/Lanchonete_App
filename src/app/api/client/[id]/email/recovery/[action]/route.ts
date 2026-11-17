import { NextRequest, NextResponse } from "next/server";
import { isAxiosError } from "axios";
import api from "@/app/util/api";
import { customerCookieName } from "@/lib/customerCookie";

const message = 'Se houver um cadastro com este e-mail verificado nesta loja, você receberá um código válido por 5 minutos.';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403, headers });
  }
  const { id, action } = await context.params;
  if (!['request', 'confirm'].includes(action)) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404, headers });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400, headers }); }
  try {
    const response = await api.post(`/client/${encodeURIComponent(id)}/email/recovery/${action}`, body, { timeout: 15000 });
    if (action === 'request') {
      if (typeof response.data.challengeId !== 'string' || !response.data.challengeId) throw new Error('Invalid challenge');
      return NextResponse.json({ challengeId: response.data.challengeId, message }, { status: 202, headers });
    }
    if (response.data.restaurant_id !== id || typeof response.data.customer_credential !== 'string' || !response.data.customer_credential) {
      throw new Error('Invalid customer credential');
    }
    const result = NextResponse.json({ recovered: true }, { headers });
    result.cookies.set(customerCookieName(id), response.data.customer_credential, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return result;
  } catch (error) {
    const upstream = isAxiosError(error) ? error.response?.status : undefined;
    const status = upstream && [400, 429].includes(upstream) ? upstream : 503;
    const errorMessage = status === 400 ? 'Código inválido, expirado ou indisponível. Confira os dados e tente novamente.'
      : status === 429 ? 'Aguarde antes de tentar novamente.'
      : 'Recuperação indisponível. Tente novamente mais tarde.';
    return NextResponse.json({ error: errorMessage }, { status, headers });
  }
}
