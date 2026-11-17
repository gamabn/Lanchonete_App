"use client";

import { useEffect, useRef, useState } from "react";

export function useUnsavedChanges(pending: boolean, scope: string) {
  const [asking, setAsking] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const allowed = useRef(false);
  const action = useRef<(() => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  function requestLeave(next: () => void) {
    if (!pendingRef.current || allowed.current) { next(); return; }
    if (action.current) return;
    action.current = next;
    setAsking(true);
  }
  function stay() { action.current = null; setAsking(false); }
  function discard() {
    const next = action.current;
    if (!next) return;
    action.current = null;
    allowed.current = true;
    setAsking(false);
    dialogRef.current?.close();
    try { next(); } catch (error) { allowed.current = false; throw error; }
  }
  useEffect(() => { allowed.current = false; action.current = null; setAsking(false); }, [scope]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (asking && dialog && !dialog.open) dialog.showModal();
    if (!asking && dialog?.open) dialog.close();
  }, [asking]);
  useEffect(() => {
    if (!pending) { action.current = null; setAsking(false); return; }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!pendingRef.current || allowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (!pendingRef.current || allowed.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const element = event.target as Element | null;
      const anchor = typeof element?.closest === "function" ? element.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("data-preserve-product-form")) return;
      const target = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (target.origin !== current.origin || (target.pathname === current.pathname && target.search === current.search)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requestLeave(() => anchor.click());
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [pending, scope]);

  const dialog = <dialog ref={dialogRef} aria-label="Alterações não salvas"
    onCancel={event => { event.preventDefault(); stay(); }}
    className="m-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/50">
    <h2 className="text-lg font-semibold">Alterações não salvas</h2>
    <p className="mt-2 text-sm text-slate-600">Há preenchimento que ainda não foi salvo. Deseja continuar editando ou descartar e sair?</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" autoFocus onClick={stay} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Continuar editando</button>
      <button type="button" onClick={discard} className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white">Descartar alterações e sair</button>
    </div>
  </dialog>;
  return { requestLeave, dialog };
}
