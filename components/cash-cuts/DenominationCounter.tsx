"use client";

import { useEffect, useState } from "react";

type Denomination = {
  value: number;
  label: string;
  kind: "billete" | "moneda";
};

const DENOMINATIONS: Denomination[] = [
  { value: 1000, label: "$1,000", kind: "billete" },
  { value: 500, label: "$500", kind: "billete" },
  { value: 200, label: "$200", kind: "billete" },
  { value: 100, label: "$100", kind: "billete" },
  { value: 50, label: "$50", kind: "billete" },
  { value: 20, label: "$20", kind: "billete" },
  { value: 10, label: "$10", kind: "moneda" },
  { value: 5, label: "$5", kind: "moneda" },
  { value: 2, label: "$2", kind: "moneda" },
  { value: 1, label: "$1", kind: "moneda" },
  { value: 0.5, label: "$0.50", kind: "moneda" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

export type DenominationCount = { value: number; quantity: number };

/**
 * Captura el efectivo por denominación (cuántos billetes/monedas de
 * cada valor) en vez de pedir un solo monto a ojo. El total se
 * calcula solo y se reporta al padre vía onTotalChange, junto con el
 * desglose completo (solo denominaciones con cantidad > 0) para que
 * el padre pueda guardarlo como respaldo de auditoría.
 */
export default function DenominationCounter({
  disabled = false,
  onTotalChange,
}: {
  disabled?: boolean;
  onTotalChange: (total: number, breakdown: DenominationCount[]) => void;
}) {
  const [counts, setCounts] = useState<Record<number, string>>({});

  const breakdown: DenominationCount[] = DENOMINATIONS.map((d) => ({
    value: d.value,
    quantity: Number(counts[d.value] || 0),
  })).filter((d) => Number.isFinite(d.quantity) && d.quantity > 0);

  const total = breakdown.reduce((sum, d) => sum + d.quantity * d.value, 0);

  useEffect(() => {
    onTotalChange(total, breakdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, JSON.stringify(breakdown)]);

  function setQty(value: number, qty: string) {
    setCounts((current) => ({ ...current, [value]: qty }));
  }

  const billetes = DENOMINATIONS.filter((d) => d.kind === "billete");
  const monedas = DENOMINATIONS.filter((d) => d.kind === "moneda");

  return (
    <div className="space-y-5">
      <DenominationGroup
        title="Billetes"
        items={billetes}
        counts={counts}
        disabled={disabled}
        onChange={setQty}
      />

      <DenominationGroup
        title="Monedas"
        items={monedas}
        counts={counts}
        disabled={disabled}
        onChange={setQty}
      />

      <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
        <span className="text-sm font-semibold text-on-surface-variant">
          Total contado
        </span>
        <span className="text-xl font-bold text-primary">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function DenominationGroup({
  title,
  items,
  counts,
  disabled,
  onChange,
}: {
  title: string;
  items: Denomination[];
  counts: Record<number, string>;
  disabled: boolean;
  onChange: (value: number, qty: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </p>

      <div className="space-y-2">
        {items.map((d) => {
          const qty = Number(counts[d.value] || 0);
          const subtotal = (Number.isFinite(qty) ? qty : 0) * d.value;

          return (
            <div key={d.value} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-semibold text-on-surface">
                {d.label}
              </span>

              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                disabled={disabled}
                value={counts[d.value] ?? ""}
                onChange={(e) => onChange(d.value, e.target.value)}
                placeholder="0"
                className="w-24 shrink-0 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary disabled:opacity-50"
              />

              <span className="truncate text-xs text-on-surface-variant">
                × {formatCurrency(d.value)} = {formatCurrency(subtotal)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
