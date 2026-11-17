"use client";

import { useRef, useState } from "react";

export default function CustomerEmailVerification({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const lock = useRef(false);

  async function submit(action: 'request' | 'confirm') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    setHasError(false);
    try {
      const response = await fetch(`/api/client/${encodeURIComponent(restaurantId)}/email/verification/${action}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify(action === 'request' ? { email } : { challengeId, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível verificar o e-mail.');
      if (action === 'request') {
        if (typeof result.challengeId !== 'string' || !result.challengeId.trim()) throw new Error('Não foi possível confirmar o envio.');
        setChallengeId(result.challengeId);
        setCode('');
        setOpen(true);
      } else {
        if (result.verified !== true) throw new Error('Não foi possível confirmar a verificação.');
        setVerified(true);
        setCode('');
      }
      setMessage(action === 'request' ? 'Código enviado. Digite os seis dígitos recebidos por e-mail.' : 'E-mail verificado com sucesso.');
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Falha de conexão. Você pode continuar comprando sem e-mail.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <div className="mt-3 text-sm">
    <button type="button" disabled={busy} onClick={() => setOpen(!open)} className="text-orange-700 underline">
      Vincular e verificar e-mail (opcional)
    </button>
    {open && <div className="mt-2 space-y-2">
      <p className="text-xs text-slate-600">Você pode continuar comprando sem e-mail.</p>
      {!verified && <>
        <label className="block">E-mail<input aria-label="E-mail para verificação" type="email" maxLength={254}
          className="block w-full rounded border bg-white p-2 text-slate-900" value={email} disabled={busy || Boolean(challengeId)}
          onChange={event => { setEmail(event.target.value); setMessage(''); setHasError(false); }} /></label>
        <button type="button" disabled={busy || !email.trim()} onClick={() => void submit('request')}
          className="text-orange-700 disabled:opacity-50">{challengeId ? 'Reenviar código' : 'Enviar código'}</button>
        {challengeId && <div className="space-y-3 rounded-lg border border-orange-200 bg-white p-3">
          <label className="block">Código de 6 dígitos<input aria-label="Código de verificação" inputMode="numeric"
            autoComplete="one-time-code" autoFocus maxLength={6} value={code} disabled={busy}
            className="block w-full rounded border p-2 text-slate-900" onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>
          <button type="button" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => void submit('confirm')}
            className="block w-full rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
            {busy ? 'Aguarde…' : 'Confirmar código'}
          </button>
          <button type="button" disabled={busy} className="text-orange-700 underline"
            onClick={() => { setChallengeId(''); setCode(''); setMessage(''); setHasError(false); }}>
            Alterar e-mail
          </button>
        </div>}
      </>}
      {message && <p role={hasError ? 'alert' : 'status'} className={hasError ? 'text-red-700' : 'text-green-700'}>{message}</p>}
    </div>}
  </div>;
}
