"use client";
import { useState } from "react";

export default function PickupContactForm({ busy, onConfirm }: {
  busy: boolean;
  onConfirm: (contact: { name: string; phone: string }) => Promise<void>;
}) {
  const [name,setName] = useState("");
  const [phone,setPhone] = useState("");
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void onConfirm({name:name.trim(),phone}); }}>
    <p className="text-sm text-slate-600">Informe seu nome e telefone. Para retirada, não é necessário informar endereço de entrega.</p>
    <label className="block text-sm font-semibold">Nome
      <input name="name" autoComplete="name" required maxLength={120} value={name} disabled={busy}
        onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border p-3" />
    </label>
    <label className="block text-sm font-semibold">Telefone com DDD
      <input name="phone" autoComplete="tel" type="tel" inputMode="numeric" required pattern="[0-9]{11,15}" value={phone} disabled={busy}
        onChange={event => setPhone(event.target.value.replace(/\D/g,""))} className="mt-1 w-full rounded-lg border p-3" />
    </label>
    <button type="submit" disabled={busy || !name.trim() || !/^\d{11,15}$/.test(phone)}
      className="rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300">Confirmar identificação</button>
  </form>;
}
