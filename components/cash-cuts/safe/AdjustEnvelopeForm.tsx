"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type AdjustmentDirection = "INCREMENTAR" | "REDUCIR";

export function AdjustEnvelopeForm({
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
  const [direction, setDirection] = useState<AdjustmentDirection>("INCREMENTAR");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Captura un importe de ajuste válido.");
      return;
    }
    if (direction === "REDUCIR" && value > maxAmount) {
      setError(`No puedes reducir más de $${maxAmount.toFixed(2)}.`);
      return;
    }
    if (!reason.trim()) {
      setError("El motivo del ajuste es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const delta = direction === "INCREMENTAR" ? value : -value;
      const response = await fetch(`/api/cash-cuts/safe/envelopes/${envelopeId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "No se pudo aplicar el ajuste.");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
      <p className="text-xs text-on-surface-variant">
        Ajuste administrativo. El servidor requiere permiso de administrador y registra el motivo en el historial.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Tipo de ajuste
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as AdjustmentDirection)}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm normal-case tracking-normal text-on-surface outline-none focus:border-on-surface"
          >
            <option value="INCREMENTAR">Incrementar saldo</option>
            <option value="REDUCIR">Reducir saldo</option>
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Importe
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={direction === "REDUCIR" ? maxAmount : undefined}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm normal-case tracking-normal text-on-surface outline-none focus:border-on-surface"
            placeholder="0.00"
            autoFocus
          />
        </label>
      </div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        Motivo
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm normal-case tracking-normal text-on-surface outline-none focus:border-on-surface"
          placeholder="Ej. Diferencia confirmada en arqueo"
        />
      </label>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Guardando..." : "Confirmar ajuste"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
