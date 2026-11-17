import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAxiosError } from "axios";
import api from "@/app/util/api";
import { customerCookieName } from "@/lib/customerCookie";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; action: string }> }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403, headers });
  }
  const { id, action } = await context.params;
  if (!['request', 'confirm'].includes(action)) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404, headers });
  const token = (await cookies()).get(customerCookieName(id))?.value;
  if (!token) return NextResponse.json({ error: 'Sessão de cliente obrigatória.' }, { status: 401, headers });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400, headers }); }
  try {
    const response = await api.post(`/client/${encodeURIComponent(id)}/email/verification/${action}`, body, {
      headers: { Authorization: `Bearer ${token}` }, timeout: 15000,
    });
    // Never forward credentials, cookies or arbitrary provider responses to browser code.
    const data = action === 'request'
      ? { challengeId: response.data.challengeId, message: 'Código enviado. Ele expira em 5 minutos.' }
      : { verified: response.data.verified === true, message: 'E-mail verificado.' };
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status ?? 503 : 503;
    const message = status === 400 ? 'Confira o e-mail ou o código. Ele pode ter expirado ou já ter sido utilizado.'
      : status === 401 || status === 403 ? 'Confirme sua sessão de cliente nesta loja.'
      : status === 429 ? 'Aguarde antes de solicitar outro código.'
      : 'Verificação indisponível. Você pode continuar comprando sem e-mail.';
    return NextResponse.json({ error: message }, { status, headers });
  }
}
