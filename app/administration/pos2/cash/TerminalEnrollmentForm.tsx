"use client";

import { useActionState } from "react";
import { createTerminalAction, type EnrollmentState } from "./actions";

export function TerminalEnrollmentForm({ branches, terminals }: { branches: Array<{ id: string; name: string }>; terminals: Array<{ id: string; branchId: string; branchName: string; name: string; status: string; credentialIssuedAt: string | null }> }) {
  const [state, action, pending] = useActionState<EnrollmentState, FormData>(createTerminalAction, {});
  return <div className="space-y-4 rounded-xl border border-outline-variant p-4">
    <form action={action} className="space-y-3">
      <h2 className="font-semibold">Autorizar terminal</h2>
      <select name="branchId" required className="w-full rounded-lg border p-2">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <input name="name" required placeholder="iPad barra" className="w-full rounded-lg border p-2" />
      <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-on-primary">{pending ? "Creando…" : "Crear token de enrolamiento"}</button>
      {state.token && <div className="rounded-lg bg-surface-container p-3"><p className="text-sm font-medium">Token de un solo uso para {state.terminalName}</p><code className="break-all text-sm">{state.token}</code><p className="mt-1 text-xs text-on-surface-variant">Se muestra una sola vez y expira en 15 minutos.</p></div>}
    </form>
    <form action={action} className="space-y-3 border-t border-outline-variant pt-4" onSubmit={(event) => { if (!window.confirm("La credencial actual dejará de funcionar. Deberás activar nuevamente este dispositivo.")) event.preventDefault(); }}>
      <h2 className="font-semibold">Rotar credencial existente</h2>
      <select name="terminalId" required className="w-full rounded-lg border p-2">{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.branchName} · {terminal.name} · {terminal.status}</option>)}</select>
      <input name="deviceIdentifier" required placeholder="Identificador de este dispositivo" className="w-full rounded-lg border p-2" />
      <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-on-primary">{pending ? "Rotando…" : "Rotar credencial"}</button>
      {state.credential && <div className="rounded-lg bg-surface-container p-3"><p className="text-sm font-medium">Credencial de un solo uso para {state.terminalName}</p><div className="flex gap-2"><input aria-label="Credencial emitida" readOnly value={state.credential} className="min-w-0 flex-1 rounded border bg-white p-2 font-mono text-sm"/><button type="button" className="rounded border px-3 text-sm" onClick={() => void navigator.clipboard.writeText(state.credential ?? "")}>Copiar</button></div><p className="mt-1 text-xs text-on-surface-variant">Se muestra una sola vez; mantenla solo en el dispositivo autorizado.</p></div>}
      {state.error && <p className="text-error">{state.error}</p>}
    </form>
  </div>;
}
