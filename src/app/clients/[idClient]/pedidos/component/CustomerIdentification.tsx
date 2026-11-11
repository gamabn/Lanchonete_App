"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormClient, type AddressData, type Bairro } from "./index";
import {
  currentCustomer, customerAddress, endCustomerSession, saveCustomerIdentification,
  CustomerIdentificationError, type IdentifiedCustomer,
} from "@/app/util/customerIdentification";
import { clearCustomerBrowserData } from "@/app/util/customerStorage";

type Session =
  | { status: "loading" }
  | { status: "ready"; customer: IdentifiedCustomer | null }
  | { status: "error"; code: string; message: string };

export default function CustomerIdentification({ restaurantId, bairros, loadingBairros, initialData, initialCustomerId, onIdentified, onLogout, onClose }: {
  restaurantId: string;
  bairros: Bairro[];
  loadingBairros: boolean;
  initialData: AddressData | null;
  initialCustomerId?: string;
  onIdentified: (address: AddressData, customer: IdentifiedCustomer) => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSession({ status: "loading" });
    setConfirmed(false);
    currentCustomer(restaurantId).then((customer) => {
      if (active) setSession({ status: "ready", customer });
    }).catch((failure) => {
      if (active) setSession({
        status: "error",
        code: failure instanceof CustomerIdentificationError ? failure.code : "CUSTOMER_UNAVAILABLE",
        message: failure instanceof Error ? failure.message : "Não foi possível consultar a sessão.",
      });
    });
    return () => { active = false; };
  }, [restaurantId, revision]);

  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await endCustomerSession(restaurantId);
      clearCustomerBrowserData(restaurantId);
      if (!mounted.current) return;
      onLogout();
      setConfirmed(false);
      setSession({ status: "ready", customer: null });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível encerrar a sessão.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function identify(address: AddressData) {
    if (lock.current || session.status !== "ready") return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const customer = await saveCustomerIdentification(restaurantId, address, session.customer);
      if (!session.customer) clearCustomerBrowserData(restaurantId);
      if (mounted.current) onIdentified(customerAddress(customer), customer);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível confirmar seus dados.");
      setConfirmed(false);
      setRevision((value) => value + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const customer = session.status === "ready" ? session.customer : null;
  const showForm = session.status === "ready" && (!customer || confirmed);
  // The authenticated profile supplies identity; an in-memory address may supply delivery fields.
  const formAddress = useMemo(() => customer ? {
    ...customerAddress(customer),
    ...(initialCustomerId === customer.id ? initialData ?? {} : {}),
    name: customer.name, phone: customer.phone,
  } : null, [customer, initialData, initialCustomerId]);

  return (
    <section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Identificação do cliente</h2>
        <button type="button" disabled={busy} onClick={onClose} className="text-sm font-semibold text-slate-600">Fechar</button>
      </header>
      {session.status === "loading" && <p role="status">Consultando a sessão desta loja…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {session.status === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-700">{session.message}</p>
          <button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)}
            className="text-sm font-semibold text-orange-700">Consultar sessão novamente</button>
          {["SESSION_EXPIRED", "SESSION_INVALID", "CUSTOMER_NOT_FOUND"].includes(session.code) && (
            <button type="button" disabled={busy} onClick={() => void logout()}
              className="block text-sm font-semibold text-slate-700">Encerrar sessão e iniciar novo cadastro</button>
          )}
        </div>
      )}
      {customer && (
        <div className="mb-4 space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="font-semibold">{customer.name}</p>
          <p className="text-sm">{customer.phone}</p>
          {!confirmed && <button type="button" disabled={busy} onClick={() => setConfirmed(true)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">Continuar como {customer.name}</button>}
          <button type="button" disabled={busy} onClick={() => void logout()}
            className="block text-sm font-semibold text-orange-800 underline">Não sou eu / Trocar cliente</button>
        </div>
      )}
      {showForm && (
        <>
          {!customer && <p className="mb-3 text-sm text-slate-600">Informe seus dados para iniciar um novo cadastro nesta loja. O telefone é um dado de contato.</p>}
          <FormClient
            key={customer?.id ?? "new"} onSubmitAddress={identify}
            handleActive={onClose} initialData={formAddress} bairros={bairros}
            loadingBairros={loadingBairros} identityReadOnly={Boolean(customer)} busy={busy}
          />
        </>
      )}
      {busy && <p role="status" className="mt-3 text-sm text-slate-600">Processando identificação…</p>}
    </section>
  );
}
