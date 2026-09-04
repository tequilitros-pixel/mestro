"use client";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

interface CashCutSummary {
  cashCounted: number;
  cashExpected: number;
  difference: number;
  envelopeAmount: number;
  nextFund: number;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function CashCutSummaryCard({ summary }: { summary: CashCutSummary }) {
  const isDifference = Math.abs(summary.difference) > 0.01;
  const isLoss = summary.difference < 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-outline-variant bg-surface-container-low p-4 sm:relative sm:border-t-0 sm:p-0 sm:mb-4">
      <div className="mx-auto max-w-2xl grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <Card className={isDifference && isLoss ? "ring-1 ring-error" : ""}>
          <CardLabel className="text-xs">Contado</CardLabel>
          <CardValue className="text-lg">{formatMoney(summary.cashCounted)}</CardValue>
        </Card>

        <Card>
          <CardLabel className="text-xs">Esperado</CardLabel>
          <CardValue className="text-lg">{formatMoney(summary.cashExpected)}</CardValue>
        </Card>

        <Card>
          <CardLabel className="text-xs">Al sobre</CardLabel>
          <CardValue className="text-lg">{formatMoney(summary.envelopeAmount)}</CardValue>
        </Card>

        <Card highlight={isDifference}>
          <CardLabel className="text-xs">Diferencia</CardLabel>
          <div className="flex items-center gap-1.5">
            {isDifference && (isLoss ? <AlertIcon className="h-4 w-4 text-error" /> : <CheckIcon className="h-4 w-4 text-tertiary-fixed-dim" />)}
            <CardValue className={`text-lg ${isLoss ? "text-error" : "text-on-surface"}`}>
              {formatMoney(summary.difference)}
            </CardValue>
          </div>
        </Card>
      </div>
    </div>
  );
}
