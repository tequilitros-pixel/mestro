"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertIcon, CheckIcon, PackageIcon } from "@/components/ui/icons";
import {
  formatCommercialQuantity,
  formatCommercialPresentation,
  getInventoryCaptureDescriptor,
  getNormalizedContentPerUnit,
  hasValidCommercialConversion,
} from "@/lib/inventory/units";
import { getStockShortfall } from "@/lib/inventory/stockSelection";
import { updateBranchInventoryMinimumAction } from "./actions";

export type BranchStockMinimumRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: number | null;
  contentUnit: string | null;
  normalizedContentPerUnit: number | null;
  stock: number;
  minimumQuantity: number;
};

type Props = {
  branchId: string;
  branchName: string;
  rows: BranchStockMinimumRow[];
  canEdit: boolean;
};

function inputValueForMinimum(row: BranchStockMinimumRow, minimumQuantity: number) {
  const descriptor = getInventoryCaptureDescriptor(minimumQuantity, row);
  return descriptor.quantity === null ? "" : String(descriptor.quantity);
}

function minimumInputUnit(row: BranchStockMinimumRow) {
  return getInventoryCaptureDescriptor(1, row).unitLabel;
}

function commercialLabel(row: BranchStockMinimumRow) {
  const config = { ...row, productName: row.name };
  return hasValidCommercialConversion(config)
    ? formatCommercialPresentation(config) ?? "Presentación por configurar"
    : "Presentación por configurar";
}

function inputToBaseQuantity(row: BranchStockMinimumRow, value: string) {
  const quantity = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const content = getNormalizedContentPerUnit(row);
  return content === null ? quantity : quantity * content;
}

function MinimumEditor({
  branchId,
  row,
  onSaved,
}: {
  branchId: string;
  row: BranchStockMinimumRow;
  onSaved: (minimumQuantity: number) => void;
}) {
  const [value, setValue] = useState(() => inputValueForMinimum(row, row.minimumQuantity));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const baseQuantity = inputToBaseQuantity(row, value);
  const isDirty = baseQuantity !== null && Math.abs(baseQuantity - row.minimumQuantity) > 0.000001;

  function save() {
    if (baseQuantity === null) {
      setMessage("Captura un mínimo válido.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await updateBranchInventoryMinimumAction({
        branchId,
        inventoryProductId: row.id,
        minimumQuantity: String(baseQuantity),
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      const saved = Number(result.minimumQuantity);
      onSaved(saved);
      setMessage("Guardado");
    });
  }

  return (
    <div className="min-w-[170px]">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`Mínimo de ${row.name} en esta sucursal`}
          className="w-20 rounded-lg border border-outline-variant bg-background px-2 py-1.5 text-right text-sm text-on-surface"
        />
        <span className="max-w-20 truncate text-xs text-on-surface-variant" title={minimumInputUnit(row)}>
          {minimumInputUnit(row)}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={isPending || !isDirty}
          className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPending ? "…" : "Guardar"}
        </button>
      </div>
      {message && (
        <p className={`mt-1 text-xs ${message === "Guardado" ? "text-tertiary-fixed-dim" : "text-error"}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default function BranchStockMinimumsClient({ branchId, branchName, rows: initialRows, canEdit }: Props) {
  const [rows, setRows] = useState(initialRows);
  const shortages = useMemo(
    () => rows
      .map((row) => ({ ...row, shortfall: getStockShortfall(row.stock, row.minimumQuantity) }))
      .filter((row) => row.shortfall > 0)
      .sort((a, b) => b.shortfall - a.shortfall),
    [rows],
  );
  const configuredProducts = rows.filter((row) => row.minimumQuantity > 0).length;

  function updateMinimum(productId: string, minimumQuantity: number) {
    setRows((current) => current.map((row) => (
      row.id === productId ? { ...row, minimumQuantity } : row
    )));
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <p className="text-xs font-semibold text-on-surface-variant">Productos con mínimo configurado</p>
          <p className="mt-1 text-3xl font-bold text-on-surface">{configuredProducts}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${shortages.length > 0 ? "border-error/40 bg-error/5" : "border-tertiary-fixed-dim/35 bg-tertiary-fixed-dim/5"}`}>
          <p className="text-xs font-semibold text-on-surface-variant">Productos por surtir</p>
          <p className={`mt-1 text-3xl font-bold ${shortages.length > 0 ? "text-error" : "text-tertiary-fixed-dim"}`}>{shortages.length}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <p className="text-xs font-semibold text-on-surface-variant">Sucursal</p>
          <p className="mt-1 truncate text-lg font-bold text-on-surface">{branchName}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        <div className="border-b border-outline-variant px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-full p-2 ${shortages.length > 0 ? "bg-error/10 text-error" : "bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim"}`}>
              {shortages.length > 0 ? <AlertIcon className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-bold text-on-surface">Lista para surtir</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {shortages.length > 0
                  ? "Estas son las cantidades que faltan para alcanzar el mínimo de esta sucursal."
                  : configuredProducts > 0
                    ? "La sucursal cumple todos sus mínimos configurados."
                    : "Configura mínimos por producto para generar automáticamente esta lista."}
              </p>
            </div>
          </div>
        </div>

        {shortages.length > 0 ? (
          <div className="divide-y divide-outline-variant">
            {shortages.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface">{row.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Hay {formatCommercialQuantity(row.stock, row)} · mínimo {formatCommercialQuantity(row.minimumQuantity, row)}
                  </p>
                </div>
                <p className="shrink-0 rounded-xl bg-error/10 px-3 py-2 text-sm font-bold text-error">
                  Llevar {formatCommercialQuantity(row.shortfall, row)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-5 py-7 text-sm text-on-surface-variant">
            <PackageIcon className="h-5 w-5" />
            No hay faltantes para surtir.
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-on-surface-variant">
              <th className="sticky left-0 bg-surface-container px-4 py-3 sm:px-5">Producto</th>
              <th className="px-4 py-3">Presentación</th>
              <th className="px-4 py-3 text-right">Existencia actual</th>
              <th className="px-4 py-3">Mínimo de esta sucursal</th>
              <th className="px-4 py-3 text-right">Faltante</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">No hay productos que coincidan con la búsqueda.</td>
              </tr>
            )}
            {rows.map((row) => {
              const shortfall = getStockShortfall(row.stock, row.minimumQuantity);
              const underMinimum = shortfall > 0;
              return (
                <tr key={row.id} className={`border-t border-outline-variant ${underMinimum ? "bg-error/5" : ""}`}>
                  <td className="sticky left-0 bg-surface-container px-4 py-3 font-medium text-on-surface sm:px-5">
                    {row.name}
                    <span className="ml-2 text-xs font-normal text-on-surface-variant">{row.category}</span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{commercialLabel(row)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${underMinimum ? "text-error" : "text-on-surface"}`}>
                    {formatCommercialQuantity(row.stock, row)}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <MinimumEditor key={`${row.id}:${row.minimumQuantity}`} branchId={branchId} row={row} onSaved={(minimumQuantity) => updateMinimum(row.id, minimumQuantity)} />
                    ) : row.minimumQuantity > 0 ? (
                      <span className="text-on-surface">{formatCommercialQuantity(row.minimumQuantity, row)}</span>
                    ) : (
                      <span className="text-on-surface-variant">Sin mínimo</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${underMinimum ? "text-error" : "text-on-surface-variant"}`}>
                    {underMinimum ? formatCommercialQuantity(shortfall, row) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-xs leading-5 text-on-surface-variant">
        Los mínimos son independientes para cada sucursal y solo sirven para comparar y surtir. Guardarlos no modifica el conteo semanal, el saldo ni los movimientos de inventario.
      </p>
    </div>
  );
}
