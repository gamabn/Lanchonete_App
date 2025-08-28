'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import api from '../util/api';
import { useRouter } from 'next/navigation';


export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMsg('');

  if (!token) return setMsg('Token ausente');

  try {
  {/*}  const res = await fetch(`http://localhost:3333/auth/reset/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });*/}
    const res = await api.post('/auth/reset/validate', { token, password });

    //const data = await res.json(); // sempre JSON

    // Aqui você verifica a propriedade que vem do backend
    //if (!res.ok) throw new Error(data.error || 'Falha ao redefinir');
 router.push('/auth/login');

  setMsg(res.data.message);
  } catch (err: any) {
    setMsg(err.message);
  }
};

  return (
    <div className='flex p-5 items-center justify-center flex-col'>
      <h1 className='text-2xl font-bold text-center'>Redefinir senha</h1>
      <form onSubmit={handleSubmit}>
        <input
        className='border rounded-lg p-2 mb-2 mt-4 w-full'
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha"
          required
        />
        <button 
        className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full mt-4'
        type="submit">
          Salvar
          </button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  );
}
