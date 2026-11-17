"use client";

import { useRef, useState } from "react";

export default function CustomerEmailRecovery({ restaurantId, disabled = false, onRecovered, onActiveChange, onBusyChange }: {
  restaurantId: string;
  disabled?: boolean;
  onRecovered: () => void;
  onActiveChange: (active: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function submit(action: 'request' | 'confirm') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/client/${encodeURIComponent(restaurantId)}/email/recovery/${action}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify(action === 'request' ? { email } : { challengeId, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível recuperar o cadastro.');
      if (action === 'request') {
        if (typeof result.challengeId !== 'string' || !result.challengeId) throw new Error('Resposta inválida. Tente novamente.');
        setChallengeId(result.challengeId);
        setCode('');
        setMessage('Se houver um cadastro com este e-mail verificado nesta loja, você receberá um código válido por 5 minutos.');
      } else {
        if (result.recovered !== true) throw new Error('Não foi possível recuperar o cadastro.');
        setCode('');
        onRecovered();
      }
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'Falha de conexão. Tente novamente.');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return <div className="my-3 text-sm">
    <button type="button" disabled={busy || disabled} className="text-slate-600 underline" onClick={() => {
      setOpen(!open); onActiveChange(!open);
    }}>Recuperar meu cadastro</button>
    {open && <div className="mt-3 space-y-3 rounded-lg border border-orange-200 p-3">
      <p className="text-slate-600">Use o e-mail que você já verificou nesta loja.</p>
      <label className="block">E-mail<input aria-label="E-mail para recuperação" type="email" maxLength={254}
        value={email} disabled={busy || Boolean(challengeId)} onChange={event => setEmail(event.target.value)}
        className="block w-full rounded border bg-white p-2 text-slate-900" /></label>
      <button type="button" disabled={busy || !email.trim()} onClick={() => void submit('request')}
        className="text-orange-700 disabled:opacity-50">{challengeId ? 'Reenviar código' : 'Solicitar código'}</button>
      {challengeId && <>
        <label className="block">Código de 6 dígitos<input aria-label="Código de recuperação" inputMode="numeric"
          autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
          onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
          className="block w-full rounded border bg-white p-2 text-slate-900" /></label>
        <button type="button" disabled={busy || !/^\d{6}$/.test(code)} onClick={() => void submit('confirm')}
          className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? 'Aguarde…' : 'Recuperar cadastro'}
        </button>
        <button type="button" disabled={busy} className="block text-orange-700 underline" onClick={() => {
          setChallengeId(''); setCode(''); setMessage(''); setError('');
        }}>Alterar e-mail</button>
      </>}
      {message && <p role="status" className="text-slate-600">{message}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>}
  </div>;
}
