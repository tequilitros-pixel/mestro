// PENDIENTE DE SCHEMA -- depende de /api/cash-cuts/safe/envelopes
// Destino: components/cash-cuts/safe/BranchSafeSummaryCard.tsx
"use client";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { LockIcon, InboxIcon, AlertIcon } from "@/components/ui/icons";
import type { BranchSafeSummary } from "@/lib/cash-cuts/safeEnvelopes";

const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

export function BranchSafeSummaryCard({
  summary,
  selected,
  onSelect,
}: {
  summary: BranchSafeSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="text-left w-full">
      <Card highlight={selected} className={selected ? "ring-1 ring-primary" : ""}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <LockIcon className="h-4 w-4 text-on-surface-variant" />
            <CardLabel>{summary.branch}</CardLabel>
          </div>
          {summary.pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-bold text-secondary">
              <AlertIcon className="h-3 w-3" />
              {summary.pendingCount} pendiente{summary.pendingCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <CardValue>{formatMoney(summary.balance)}</CardValue>

        <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <InboxIcon className="h-3.5 w-3.5" />
            {summary.envelopeCount} sobre{summary.envelopeCount === 1 ? "" : "s"} con saldo
          </span>
          {summary.legacyBalance > 0 && (
            <span title="Saldo previo al sistema de sobres individuales">
              · legado {formatMoney(summary.legacyBalance)}
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}
