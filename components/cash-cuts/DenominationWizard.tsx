"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import {
  CASH_DENOMINATIONS,
  denominationTotal,
  type CashDenominationCount,
} from "@/lib/cash-cuts/denominations";

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function DenominationWizard({
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (total: number, breakdown: CashDenominationCount[]) => void | Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const breakdown = useMemo(
    () => CASH_DENOMINATIONS.map((value) => ({
      value,
      quantity: Math.max(0, Math.floor(Number(counts[String(value)]) || 0)),
    })).filter((row) => row.quantity > 0),
    [counts],
  );
  const total = denominationTotal(breakdown);
  const value = CASH_DENOMINATIONS[index];

  useEffect(() => {
    if (!reviewing) inputRef.current?.focus();
  }, [index, reviewing]);

  function continueCounting() {
    if (index < CASH_DENOMINATIONS.length - 1) setIndex((current) => current + 1);
    else setReviewing(true);
  }

  if (reviewing) {
    return (
      <div className="space-y-4">
        <Card highlight className="text-center">
          <CardLabel>Total contado</CardLabel>
          <CardValue>{money(total)}</CardValue>
          <p className="mt-2 text-sm text-on-surface-variant">¿Es correcto? Puedes editar cualquier cantidad antes de confirmar.</p>
        </Card>

        <Card>
          <div className="space-y-3">
            {CASH_DENOMINATIONS.map((denomination, rowIndex) => (
              <label key={denomination} className="flex items-center gap-3">
                <span className="w-24 text-sm font-bold text-on-surface">{money(denomination)}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={counts[String(denomination)] ?? ""}
                  onChange={(event) => setCounts((current) => ({
                    ...current,
                    [String(denomination)]: event.target.value,
                  }))}
                  className="w-24 rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  aria-label={`Cantidad de ${money(denomination)}`}
                />
                <span className="text-xs text-on-surface-variant">
                  {money(denomination * (Number(counts[String(denomination)]) || 0))}
                </span>
                <button
                  type="button"
                  onClick={() => { setIndex(rowIndex); setReviewing(false); }}
                  className="ml-auto text-xs font-semibold text-primary"
                >
                  Editar
                </button>
              </label>
            ))}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIndex(CASH_DENOMINATIONS.length - 1); setReviewing(false); }}>
            Regresar
          </Button>
          <Button type="button" size="lg" className="flex-1" disabled={busy} onClick={() => onConfirm(total, breakdown)}>
            {busy ? "Guardando..." : confirmLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
      <div className="flex gap-1" aria-label={`Denominación ${index + 1} de ${CASH_DENOMINATIONS.length}`}>
        {CASH_DENOMINATIONS.map((denomination, stepIndex) => (
          <span key={denomination} className={`h-1.5 flex-1 rounded-full ${stepIndex <= index ? "bg-primary" : "bg-surface-container-highest"}`} />
        ))}
      </div>
      <Card highlight className="py-8 text-center">
        <p className="text-sm text-on-surface-variant">
          {value >= 20 ? "¿Cuántos billetes tienes de" : "¿Cuántas monedas tienes de"}
        </p>
        <p className="mt-2 text-4xl font-black text-on-surface">{money(value)}?</p>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={counts[String(value)] ?? ""}
          onChange={(event) => setCounts((current) => ({ ...current, [String(value)]: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); continueCounting(); }
          }}
          className="mx-auto mt-6 block w-36 rounded-2xl border border-outline-variant bg-background px-4 py-4 text-center text-3xl font-bold text-on-surface outline-none focus:border-primary"
          placeholder="0"
          aria-label={`Cantidad de ${money(value)}`}
        />
        <p className="mt-3 text-sm text-on-surface-variant">
          Subtotal: {money(value * (Number(counts[String(value)]) || 0))}
        </p>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
          Anterior
        </Button>
        <span className="text-sm font-bold text-on-surface">Acumulado: {money(total)}</span>
        <Button type="button" onClick={continueCounting}>
          {index === CASH_DENOMINATIONS.length - 1 ? "Revisar" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
