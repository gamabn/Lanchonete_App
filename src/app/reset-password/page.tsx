'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMsg('');

  if (!token) return setMsg('Token ausente');

  try {
    const res = await fetch(`http://localhost:3333/auth/reset/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await res.json(); // sempre JSON

    // Aqui você verifica a propriedade que vem do backend
    if (!res.ok) throw new Error(data.error || 'Falha ao redefinir');

    setMsg(data.message || 'Senha redefinida com sucesso!');
  } catch (err: any) {
    setMsg(err.message);
  }
};

  return (
    <div>
      <h1>Redefinir senha</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha"
          required
        />
        <button type="submit">Salvar</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
