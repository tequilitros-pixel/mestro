"use client";
import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PendingEnvelope {
  id: string;
  code: string;
  cutDate: string;
  originalAmount: number;
  cashCut: { id: string; code: string } | null;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const formatDate = (v: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(v));

export function PendingEnvelopeRow({
  envelope,
  canReceive,
  onChanged,
}: {
  envelope: PendingEnvelope;
  canReceive: boolean;
  onChanged: () => void;
}) {
  const [receiving, setReceiving] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(String(envelope.originalAmount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReceive() {
    setError(null);
    const value = Number(receivedAmount);
    if (!Number.isFinite(value) || value < 0) {
      setError("Captura una cantidad válida.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cash-cuts/safe/envelopes/${envelope.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedAmount: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo recibir el sobre.");
        return;
      }
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const differs = Number(receivedAmount) !== envelope.originalAmount;

  return (
    <Card className="border-secondary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-on-surface">{envelope.code}</p>
          <p className="text-xs capitalize text-on-surface-variant">{formatDate(envelope.cutDate)}</p>
        </div>
        <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold text-secondary">
          Pendiente de recibir
        </span>
      </div>

      <div className="mt-2">
        <CardLabel>Monto esperado</CardLabel>
        <p className="text-lg font-bold text-on-surface">{formatMoney(envelope.originalAmount)}</p>
      </div>

      {canReceive && !receiving && (
        <Button size="sm" className="mt-3" onClick={() => setReceiving(true)}>
          Recibir en caja fuerte
        </Button>
      )}

      {receiving && (
        <div className="mt-3 space-y-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Cantidad recibida (contada físicamente)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={receivedAmount}
            onChange={(e) => setReceivedAmount(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            autoFocus
          />
          {differs && (
            <p className="text-xs text-secondary">
              Difiere del monto esperado — se registrará un ajuste automático con esta diferencia. No se oculta.
            </p>
          )}
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={confirmReceive}>
              {saving ? "Guardando..." : "Confirmar recepción"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReceiving(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
