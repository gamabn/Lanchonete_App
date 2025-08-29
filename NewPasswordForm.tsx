"use client"

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function NewPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('');

  // Se não houver token, você pode mostrar uma mensagem de erro.
  if (!token) {
    return <p className="text-red-500">Token de redefinição inválido ou ausente.</p>
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aqui você colocaria a lógica para enviar o token e a nova senha para sua API
    console.log({ token, password });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">Redefinindo senha para o token: {token.substring(0, 10)}...</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Digite sua nova senha"
        className="p-2 border rounded-lg"
      />
      <button type="submit" className="bg-blue-500 text-white p-2 rounded-lg">Salvar Nova Senha</button>
    </form>
  )
}