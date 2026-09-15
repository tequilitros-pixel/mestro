"use client";
import { useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { EnvelopeMovementHistory } from "./EnvelopeMovementHistory";
import { WithdrawEnvelopeForm } from "./WithdrawEnvelopeForm";
import { AdjustEnvelopeForm } from "./AdjustEnvelopeForm";

interface EnvelopeSummary {
  id: string;
  code: string;
  cutDate: string;
  originalAmount: number;
  currentBalance: number;
  status: "PENDIENTE" | "EN_CAJA_FUERTE" | "PARCIAL" | "VACIO";
  cashCut: { id: string; code: string } | null;
  createdBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const formatDate = (v: string) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(v));

const STATUS_LABEL: Record<EnvelopeSummary["status"], string> = {
  PENDIENTE: "Pendiente de recibir",
  EN_CAJA_FUERTE: "En caja fuerte",
  PARCIAL: "Parcial",
  VACIO: "Vacío",
};

const STATUS_CLASS: Record<EnvelopeSummary["status"], string> = {
  PENDIENTE: "bg-secondary/10 text-secondary",
  EN_CAJA_FUERTE: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim",
  PARCIAL: "bg-surface-container-highest text-on-surface",
  VACIO: "bg-surface-container-highest text-on-surface-variant",
};

export function EnvelopeRow({
  envelope,
  canWithdraw,
  onChanged,
}: {
  envelope: EnvelopeSummary;
  canWithdraw: boolean;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [confirmingFull, setConfirmingFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdrawFull() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cash-cuts/safe/envelopes/${envelope.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: true, reason: "Retiro de sobre completo" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo retirar el sobre completo");
        return;
      }
      setConfirmingFull(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-on-surface">{envelope.code}</p>
          <p className="text-xs text-on-surface-variant capitalize">{formatDate(envelope.cutDate)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[envelope.status]}`}>
          {STATUS_LABEL[envelope.status]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <CardLabel>Original</CardLabel>
          <p className="font-bold text-on-surface">{formatMoney(envelope.originalAmount)}</p>
        </div>
        <div>
          <CardLabel>Disponible</CardLabel>
          <p className="font-bold text-on-surface">{formatMoney(envelope.currentBalance)}</p>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      {canWithdraw && envelope.status !== "PENDIENTE" && envelope.status !== "VACIO" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowWithdraw((v) => !v)}>
            Retirar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAdjust((v) => !v)}>
            Ajustar saldo
          </Button>
          {!confirmingFull ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingFull(true)}>
              Retirar sobre completo
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-2 py-1">
              <span className="text-xs text-error">
                ¿Retirar {formatMoney(envelope.currentBalance)} y dejar el sobre en $0?
              </span>
              <Button size="sm" variant="danger" disabled={busy} onClick={withdrawFull}>
                {busy ? "..." : "Confirmar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingFull(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {showWithdraw && (
        <WithdrawEnvelopeForm
          envelopeId={envelope.id}
          maxAmount={envelope.currentBalance}
          onDone={() => {
            setShowWithdraw(false);
            onChanged();
          }}
          onCancel={() => setShowWithdraw(false)}
        />
      )}

      {showAdjust && (
        <AdjustEnvelopeForm
          envelopeId={envelope.id}
          maxAmount={envelope.currentBalance}
          onDone={() => {
            setShowAdjust(false);
            onChanged();
          }}
          onCancel={() => setShowAdjust(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <ChevronDownIcon className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90" : ""}`} />
        {expanded ? "Ocultar movimientos" : "Ver movimientos"}
      </button>

      {expanded && <EnvelopeMovementHistory envelopeId={envelope.id} />}
    </Card>
  );
}
