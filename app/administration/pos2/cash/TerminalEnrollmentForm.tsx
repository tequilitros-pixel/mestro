"use client";

import { useActionState } from "react";
import { createTerminalAction, type EnrollmentState } from "./actions";

export function TerminalEnrollmentForm({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<EnrollmentState, FormData>(createTerminalAction, {});
  return <form action={action} className="space-y-3 rounded-xl border border-outline-variant p-4">
    <h2 className="font-semibold">Autorizar terminal</h2>
    <select name="branchId" required className="w-full rounded-lg border p-2">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
    <input name="name" required placeholder="iPad barra" className="w-full rounded-lg border p-2" />
    <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-on-primary">{pending ? "Creando…" : "Crear token de enrolamiento"}</button>
    {state.error && <p className="text-error">{state.error}</p>}
    {state.token && <div className="rounded-lg bg-surface-container p-3">
      <p className="text-sm font-medium">Token de un solo uso para {state.terminalName}</p>
      <code className="break-all text-sm">{state.token}</code>
      <p className="mt-1 text-xs text-on-surface-variant">Se muestra una sola vez y expira en 15 minutos.</p>
    </div>}
  </form>;
}
