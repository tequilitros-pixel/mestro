"use client";

import { useState, type FormEvent } from "react";
import { captureEventSupplyReturnAction } from "../additionalActions";

export type AdditionalReturnRow = {
  id: string;
  productName: string;
  unit: string;
  sourceBranchName: string;
  quantity: number;
  returned: number;
  returnedOpen: number;
  contentPerUnit: number | null;
  contentUnit: string | null;
  captured: boolean;
  operationId: string;
};

function ReturnRow({ eventId, row, locked }: { eventId: string; row: AdditionalReturnRow; locked: boolean }) {
  const [operationId, setOperationId] = useState(row.operationId);
  const [returned, setReturned] = useState(row.captured ? String(row.returned) : "");
  const [open, setOpen] = useState(String(row.returnedOpen));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(row.captured);
  const openUnit = row.contentUnit === "L" || row.contentUnit === "ML" ? "ml" : row.contentUnit === "G" || row.contentUnit === "KG" ? "g" : "piezas";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await captureEventSupplyReturnAction({
        eventId,
        additionId: row.id,
        returnedQuantity: returned,
        returnedOpenQuantity: open,
        operationId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setOperationId(result.nextOperationId);
    } catch {
      setError("No se pudo confirmar el registro. Reintenta sin cambiar los datos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} data-event-addition-dirty={!saved ? "true" : undefined} className="grid gap-3 border-t border-outline-variant py-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-end">
      <div>
        <p className="font-semibold text-on-surface">{row.productName}</p>
        <p className="text-xs text-on-surface-variant">Carga adicional: {row.quantity} {row.unit} · {row.sourceBranchName}</p>
        <p className={`mt-1 text-xs ${saved ? "text-tertiary-fixed-dim" : "text-secondary"}`}>
          {saved ? "Regreso capturado" : "Regreso pendiente, captura 0 si no regresó nada"}
        </p>
      </div>
      <label className="text-xs text-on-surface-variant">
        Cerradas que regresan
        <input required type="number" inputMode="decimal" min="0" max={row.quantity} step="0.001" value={returned} onChange={(event) => { setReturned(event.target.value); setSaved(false); }} disabled={locked || saving} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2 py-2 text-sm text-on-surface" />
      </label>
      <label className="text-xs text-on-surface-variant">
        Remanente abierto ({openUnit})
        <input type="number" inputMode="decimal" min="0" step="0.001" value={open} onChange={(event) => { setOpen(event.target.value); setSaved(false); }} disabled={locked || saving || row.contentPerUnit === null} className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-2 py-2 text-sm text-on-surface" />
      </label>
      {!locked && <button type="submit" disabled={saving} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>}
      {error && <p role="alert" className="text-xs text-error sm:col-span-4">{error}</p>}
    </form>
  );
}

export default function AdditionalReturns({ eventId, rows, locked }: { eventId: string; rows: AdditionalReturnRow[]; locked: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h3 className="text-lg font-semibold text-on-surface">Regreso de cargas adicionales</h3>
      <p className="mt-1 text-sm text-on-surface-variant">Registra cada carga adicional por separado antes de confirmar el regreso del evento.</p>
      <div className="mt-3">
        {rows.map((row) => <ReturnRow key={row.id} eventId={eventId} row={row} locked={locked} />)}
      </div>
    </section>
  );
}
