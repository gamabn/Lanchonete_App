"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { requestProduct } from "./configuredProductClient";

export interface PrivateTemplate { id: string; name: string; description: string; version: number | null; active: boolean; source: 'private' }
const button = "rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const endpoint = '/api/product/templates/private';
export const listPrivateTemplates = () => requestProduct<PrivateTemplate[]>(endpoint, "Não foi possível carregar os modelos privados.");
const json = (method: string, body: object) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function SavePrivateTemplate({ productId, disabled, onBusy, onPendingChange }: { productId: string; disabled: boolean; onBusy: (busy: boolean) => void; onPendingChange?: (pending: boolean) => void }) {
  const [templates, setTemplates] = useState<PrivateTemplate[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmedMetadata = useRef(JSON.stringify(["", ""]));
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    listPrivateTemplates().then(rows => { if (active) setTemplates(rows); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [productId]);
  async function run(action: () => Promise<unknown>, onSaved?: () => void) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusy(true); setError(''); setNotice('');
    try {
      await action();
      onSaved?.();
      setNotice('Modelo salvo. O produto original permanece independente.');
      setTemplates(await listPrivateTemplates());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar o modelo.');
      // A stale version or ambiguous response must be reconciled before another update.
      try { setTemplates(await listPrivateTemplates()); } catch { /* keep the explicit error */ }
    } finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(() => requestProduct(endpoint, 'Não foi possível salvar o modelo.', json('POST', {
      productId, name: String(data.get('name') ?? ''), description: String(data.get('description') ?? ''),
    })), () => {
      confirmedMetadata.current = JSON.stringify([String(data.get('name') ?? ''), String(data.get('description') ?? '')]);
      onPendingChange?.(false);
    });
  }
  function update() {
    const template = templates.find(item => item.id === selected);
    if (!template?.version || !window.confirm(`Criar uma nova versão de "${template.name}" usando este produto? As cópias anteriores não serão alteradas.`)) return;
    void run(() => requestProduct(`${endpoint}/${encodeURIComponent(template.id)}/versions`, 'Não foi possível atualizar o modelo.',
      json('POST', { productId, expectedVersion: template.version })));
  }
  return <section className="space-y-3 rounded-xl border border-orange-200 p-4" aria-label="Modelos privados do produto">
    <h3 className="font-semibold">Salvar como modelo</h3>
    <p className="text-sm text-slate-600">Salve as alterações do produto primeiro. Tamanhos, grupos, opções e limites serão copiados para um modelo privado desta loja.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    <form onSubmit={save} aria-label="Salvar como modelo" onChangeCapture={event => {
      const data = new FormData(event.currentTarget);
      onPendingChange?.(JSON.stringify([String(data.get('name') ?? ''), String(data.get('description') ?? '')]) !== confirmedMetadata.current);
    }}>
      <fieldset disabled={disabled || busy} className="space-y-3">
        <label className="block text-sm">Nome do modelo<input className={input} name="name" maxLength={200} required /></label>
        <label className="block text-sm">Descrição do modelo<textarea className={input} name="description" maxLength={4000} /></label>
        <button type="submit" className={button}>Salvar como modelo</button>
      </fieldset>
    </form>
    <fieldset disabled={disabled || busy} className="space-y-3 border-t pt-3">
      <label className="block text-sm">Atualizar configuração de um modelo próprio
        <select className={input} value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Selecione um modelo</option>
          {templates.filter(item => item.active && item.version).map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}
        </select>
      </label>
      <button type="button" className={button} disabled={!selected} onClick={update}>Salvar nova versão do modelo</button>
    </fieldset>
  </section>;
}

export function PrivateTemplateManager({ templates, disabled, onChanged, onBusy }: {
  templates: PrivateTemplate[]; disabled: boolean; onChanged: () => void; onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [history, setHistory] = useState<{ id: string; versions: { version: number; active: boolean }[] }>();
  const lock = useRef(false);
  async function run(action: () => Promise<unknown>, refresh = true) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusy(true); setError(''); setNotice('');
    try {
      await action();
      if (refresh) { setHistory(undefined); setNotice('Modelo atualizado.'); onChanged(); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível gerenciar o modelo.'); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section className="space-y-3" aria-label="Gerenciar modelos privados">
    <h3 className="font-semibold">Meus modelos</h3>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {templates.length === 0 && <p className="text-sm">Nenhum modelo próprio. Use Salvar como modelo no editor de um produto.</p>}
    {templates.map(template => <form key={`${template.id}:${template.name}:${template.description}`} className="space-y-2 rounded-lg border p-3"
      aria-label={`Editar modelo ${template.name}`} onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        void run(() => requestProduct(`${endpoint}/${encodeURIComponent(template.id)}`, 'Não foi possível renomear o modelo.', json('PATCH', {
          name: String(data.get('name') ?? ''), description: String(data.get('description') ?? ''),
        })));
      }}>
      <fieldset disabled={disabled || busy} className="space-y-2">
        <p className="text-sm">Modelo privado · v{template.version ?? '—'}</p>
        <label className="block text-sm">Nome<input className={input} name="name" maxLength={200} defaultValue={template.name} required /></label>
        <label className="block text-sm">Descrição<textarea className={input} name="description" maxLength={4000} defaultValue={template.description} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={button}>Salvar nome e descrição</button>
          <button type="button" className={button} onClick={() => void run(async () => {
            const data = await requestProduct<{ versions: { version: number; active: boolean }[] }>(`${endpoint}/${encodeURIComponent(template.id)}`, 'Não foi possível consultar versões.');
            setHistory({ id: template.id, versions: data.versions });
          }, false)}>Ver versões</button>
          <button type="button" className={button} onClick={() => {
            if (window.confirm(`Excluir o modelo "${template.name}" e suas versões? Os produtos já criados serão preservados.`)) {
              void run(() => requestProduct(`${endpoint}/${encodeURIComponent(template.id)}`, 'Não foi possível excluir o modelo.', json('DELETE', {})));
            }
          }}>Excluir modelo</button>
        </div>
        {history?.id === template.id && <ul className="text-sm">{history.versions.map(version => <li key={version.version}>Versão {version.version}{version.active ? ' · atual' : ''}</li>)}</ul>}
      </fieldset>
    </form>)}
  </section>;
}
