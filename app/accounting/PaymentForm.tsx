"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS } from "@/lib/accounting";
import { createPaymentAction, voidPaymentAction, type PaymentActionResult } from "./actions";

const control = "mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary";

type Category = { id: string; name: string; requiresReason: boolean; requiresReceipt: boolean };

export function PaymentForm({ branches, categories, today, initialRequestId, initialBranchId, initialBranchName, collapsible = false }: { branches: { id: string; name: string }[]; categories: Category[]; today: string; initialRequestId: string; initialBranchId?: string; initialBranchName?: string; collapsible?: boolean }) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(initialRequestId);
  const [result, setResult] = useState<PaymentActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState(!collapsible);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  async function submit(data: FormData) {
    setSaving(true);
    setResult(null);
    try {
      const response = await createPaymentAction(data);
      setResult(response);
      if (response.success) {
        (document.getElementById("accounting-payment-form") as HTMLFormElement | null)?.reset();
        setRequestId(crypto.randomUUID());
        setCategoryId("");
        router.refresh();
      }
    } catch {
      setResult({ success: false, error: "No se pudo enviar el pago. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  if (collapsible && !open) {
    return <section aria-label={`Registrar gasto${initialBranchName ? ` en ${initialBranchName}` : ""}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container/60 p-4 sm:p-5">
      <div><h2 className="text-lg font-bold text-on-surface">Gastos de {initialBranchName}</h2><p className="text-sm text-on-surface-variant">Registra un gasto sin salir del resumen de esta sucursal.</p></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">Registrar gasto</button>
    </section>;
  }

  return (
    <form id="accounting-payment-form" action={submit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-on-surface">Registrar gasto{initialBranchName ? ` · ${initialBranchName}` : ""}</h2>
        <p className="text-sm text-on-surface-variant">Captura un pago realizado por una sucursal. El registro se conserva para consulta.</p>
        </div>
        {collapsible && <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Cancelar</button>}
      </div>
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialBranchId ? <div className="text-sm font-medium text-on-surface-variant">
          <span>Sucursal *</span>
          <input type="hidden" name="branchId" value={initialBranchId} />
          <p className={`${control} text-on-surface`}>{initialBranchName}</p>
          <p className="mt-1 text-xs font-normal text-on-surface-variant">La captura se guardará en esta pestaña.</p>
        </div> : <label className="text-sm font-medium text-on-surface-variant">Sucursal *
          <select name="branchId" required defaultValue="" className={control}>
            <option value="" disabled>Selecciona una sucursal</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>}
        <label className="text-sm font-medium text-on-surface-variant">Fecha del pago *
          <input name="paymentDate" type="date" required max={today} defaultValue={today} className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Tipo de gasto *
          <select name="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={control}>
            <option value="" disabled>Selecciona un tipo</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Concepto *
          <input name="concept" required maxLength={180} placeholder="Ej. renta de octubre" className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Pagado a *
          <input name="payee" required maxLength={120} placeholder="Proveedor o beneficiario" className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Importe (MXN) *
          <input name="amount" required type="number" min="0.01" max="999999999999.99" step="0.01" inputMode="decimal" placeholder="0.00" className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Método de pago *
          <select name="method" required defaultValue="" className={control}>
            <option value="" disabled>Selecciona un método</option>
            {PAYMENT_METHODS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Folio o referencia
          <input name="reference" maxLength={100} placeholder="Opcional" className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Comprobante (enlace HTTPS){selectedCategory?.requiresReceipt ? " *" : ""}
          <input name="receiptUrl" type="url" required={selectedCategory?.requiresReceipt} maxLength={500} placeholder="https://…" className={control} />
        </label>
        <label className="text-sm font-medium text-on-surface-variant">Notas o motivo{selectedCategory?.requiresReason ? " *" : ""}
          <input name="notes" required={selectedCategory?.requiresReason} maxLength={500} placeholder="Opcional" className={control} />
        </label>
      </div>
      {result && <p role="status" className={`rounded-lg p-3 text-sm ${result.success ? "bg-green-500/10 text-green-700" : "bg-error/10 text-error"}`}>{result.success ? result.message : result.error}</p>}
      <button type="submit" disabled={saving || branches.length === 0 || categories.length === 0} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">
        {saving ? "Guardando…" : "Guardar gasto"}
      </button>
    </form>
  );
}

export function VoidPaymentForm({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PaymentActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(data: FormData) {
    setSaving(true);
    try {
      const response = await voidPaymentAction(data);
      setResult(response);
      if (response.success) router.refresh();
    } catch {
      setResult({ success: false, error: "No se pudo anular. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return <form action={submit} className="flex flex-wrap items-end gap-2 text-xs">
    <input type="hidden" name="id" value={id} />
    <label className="text-on-surface-variant">Motivo de anulación
      <input name="reason" required minLength={8} maxLength={300} className="mt-1 block w-48 rounded-lg border border-outline-variant bg-background px-2 py-1.5 text-on-surface" />
    </label>
    <button type="submit" disabled={saving} className="rounded-lg border border-error/40 px-3 py-1.5 font-semibold text-error disabled:opacity-50">Anular</button>
    {result && <span role="status" className={result.success ? "text-green-700" : "text-error"}>{result.success ? result.message : result.error}</span>}
  </form>;
}
