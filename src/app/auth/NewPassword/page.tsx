'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<'checking'|'ok'|'error'>('checking');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    async function validate() {
      if (!token) { setStatus('error'); setMsg('Token ausente.'); return; }
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Token inválido');
        setEmail(data.email);
        setStatus('ok');
      } catch (e: any) {
        setStatus('error');
        setMsg(e.message);
      }
    }
    validate();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao redefinir.');
      setMsg('Senha redefinida com sucesso. Você já pode entrar.');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (status === 'checking') return <p>Validando link…</p>;
  if (status === 'error') return <p>Link inválido/expirado: {msg}</p>;

  return (
    <main style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Redefinir senha</h1>
      <p>Conta: <b>{email}</b></p>

      <form onSubmit={submit}>
        <label>
          Nova senha
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ display: 'block', width: '100%', marginTop: 8, marginBottom: 16 }}
          />
        </label>
        <button type="submit">Salvar nova senha</button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
