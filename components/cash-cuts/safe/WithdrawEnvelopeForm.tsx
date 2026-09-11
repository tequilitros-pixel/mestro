// PENDIENTE DE SCHEMA
// Destino: components/cash-cuts/safe/WithdrawEnvelopeForm.tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function WithdrawEnvelopeForm({
  envelopeId,
  maxAmount,
  onDone,
  onCancel,
}: {
  envelopeId: string;
  maxAmount: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string; requiresReason: boolean; requiresReceipt: boolean }>>([]);
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch("/api/financial-movement-categories?direction=EXPENSE&scope=ENVELOPE").then((r) => r.ok ? r.json() : []).then((rows) => { setCategories(rows); setCategoryId(rows[0]?.id ?? ""); }).catch(() => setCategories([])); }, []);
  const selected = categories.find((category) => category.id === categoryId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Captura una cantidad válida.");
      return;
    }
    if (value > maxAmount) {
      setError(`No puedes retirar más de $${maxAmount.toFixed(2)}.`);
      return;
    }
    if (!categoryId) { setError("Selecciona una categoría."); return; }
    if (selected?.requiresReason && !reason.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }
    if (selected?.requiresReceipt && !receiptPhotoUrl.trim()) { setError("El comprobante es obligatorio."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/cash-cuts/safe/envelopes/${envelopeId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, reason, categoryId, receiptPhotoUrl: receiptPhotoUrl || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo registrar el retiro.");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Cantidad a retirar (máx. ${maxAmount.toFixed(2)})
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={maxAmount}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          placeholder="0.00"
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Categoría</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"><option value="">Selecciona…</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Motivo{selected?.requiresReason ? " (obligatorio)" : ""}
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          placeholder="Ej. Pago a proveedor"
        />
      </div>
      {selected?.requiresReceipt && <div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Comprobante (URL)</label><input value={receiptPhotoUrl} onChange={(e) => setReceiptPhotoUrl(e.target.value)} required placeholder="URL del comprobante" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface" /></div>}
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Guardando..." : "Confirmar retiro"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
