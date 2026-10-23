"use client";
import { Card, CardLabel } from "@/components/ui/Card";
import { formatCivilDate } from "@/lib/dateTime";

interface PendingEnvelope {
  id: string;
  code: string;
  cutDate: string;
  originalAmount: number;
  cashCut: { id: string; code: string; envelopeNumber: string | null } | null;
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const formatDate = (v: string) =>
  formatCivilDate(v, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

export function PendingEnvelopeRow({
  envelope,
}: {
  envelope: PendingEnvelope;
}) {
  return (
    <Card className="border-secondary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-on-surface">
            {envelope.cashCut?.envelopeNumber ? `Sobre ${envelope.cashCut.envelopeNumber}` : envelope.code}
          </p>
          {envelope.cashCut?.envelopeNumber && (
            <p className="text-xs text-on-surface-variant">Código interno: {envelope.code}</p>
          )}
          <p className="text-xs capitalize text-on-surface-variant">{formatDate(envelope.cutDate)}</p>
        </div>
        <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold text-secondary">
          Por conciliar
        </span>
      </div>

      <div className="mt-2">
        <CardLabel>Monto esperado</CardLabel>
        <p className="text-lg font-bold text-on-surface">{formatMoney(envelope.originalAmount)}</p>
      </div>

      <p className="mt-3 text-xs text-on-surface-variant">
        Este registro antiguo requiere revisión. Los sobres nuevos entran a caja fuerte automáticamente al cerrar caja.
      </p>
    </Card>
  );
}
