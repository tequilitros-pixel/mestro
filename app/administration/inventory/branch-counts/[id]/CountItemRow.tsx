"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCountItemQuantityAction } from "../actions";
import { CheckIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import {
  formatCommercialCaptureHint,
  formatCommercialPresentation,
  formatCommercialQuantity,
  getInventoryBaseUnitLabel,
  getInventoryCaptureDescriptor,
  getInventoryCaptureInputValue,
} from "@/lib/inventory/units";
import type { InventoryCountItemClientView } from "@/lib/inventory/countPresentation";

type Item = InventoryCountItemClientView;

function formatCountQuantity(value: number, item: Item) {
  return formatCommercialQuantity(value, item);
}

export default function CountItemRow({
  item,
  countId,
  editable,
}: {
  item: Item;
  countId: string;
  editable: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const capture = getInventoryCaptureDescriptor(item.quantityCounted, item);
  const [quantity, setQuantity] = useState(() =>
    getInventoryCaptureInputValue(item.quantityCounted, item),
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateCountItemQuantityAction({
      itemId: item.id,
      countId,
      quantity: quantity.trim(),
      captureUnit: capture.captureUnit,
    });
    setSaving(false);

    if (result.success) {
      router.refresh();
      showToast(`Cantidad guardada: ${quantity.trim()} ${capture.unitLabel}.`);
    } else {
      showToast(result.error);
    }
  }

  const historyVisible = !editable && item.previousQuantity !== undefined;
  const difference = historyVisible
    ? item.quantityCounted - (item.previousQuantity ?? 0)
    : null;
  const configuredPresentation = formatCommercialPresentation(item);
  const presentation = capture.captureUnit === "PRESENTATION" && configuredPresentation
    ? configuredPresentation
    : `${getInventoryBaseUnitLabel(item)} · Presentación por configurar`;
  const captureHint = capture.captureUnit === "PRESENTATION"
    ? formatCommercialCaptureHint(item)
    : null;

  return (
    <div className="grid gap-3 border-b border-outline-variant p-4 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] md:items-center">
      <div>
        <p className="font-medium text-on-surface">{item.productName}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{presentation}</p>
        {captureHint && <p className="mt-1 text-xs text-on-surface-variant">{captureHint}</p>}
      </div>

      {editable ? (
        <div className="flex gap-1">
          <label className="sr-only" htmlFor={`count-${item.id}`}>
            Cantidad contada de {item.productName} en {capture.unitLabel}
          </label>
          <input
            id={`count-${item.id}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
          <span className="flex items-center px-1 text-sm text-on-surface-variant" aria-hidden="true">
            {capture.unitLabel}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center rounded-lg bg-surface-container-high px-2 text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-60"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Guardar cantidad</span>
          </button>
        </div>
      ) : (
        <div>
          {historyVisible && (
            <>
              <span className="block text-xs text-on-surface-variant">Teórico</span>
              <p className="text-sm text-on-surface-variant">
                {formatCountQuantity(item.previousQuantity ?? 0, item)}
              </p>
            </>
          )}
          <span className="mt-2 block text-xs text-on-surface-variant">Contado</span>
          <p className="text-sm text-on-surface-variant">
            {formatCountQuantity(item.quantityCounted, item)}
          </p>
        </div>
      )}

      {historyVisible && (
        <div>
          <span className="block text-xs text-on-surface-variant">Diferencia</span>
          <p className={`text-sm font-semibold ${difference !== null && difference < 0 ? "text-error" : "text-on-surface"}`}>
            {difference === null ? "—" : formatCountQuantity(difference, item)}
          </p>
        </div>
      )}

      {historyVisible && (
        <div>
          <span className="block text-xs text-on-surface-variant">Entradas</span>
          <p className="text-sm text-on-surface-variant">
            {item.entriesQuantity !== undefined && item.entriesQuantity !== null
              ? item.entriesQuantity
              : "—"}
          </p>
        </div>
      )}

      {historyVisible && (
        <div>
          <span className="block text-xs text-on-surface-variant">Consumido</span>
          <p className="text-sm font-semibold text-on-surface">
            {item.quantityConsumed !== undefined && item.quantityConsumed !== null
              ? item.quantityConsumed
              : "—"}
          </p>
        </div>
      )}

      {historyVisible && (
        <div>
          <span className="block text-xs text-on-surface-variant">Costo</span>
          <p className="text-sm text-tertiary-fixed-dim">
            {item.costTotal !== undefined && item.costTotal !== null
              ? `$${item.costTotal.toFixed(2)}`
              : "—"}
          </p>
        </div>
      )}
    </div>
  );
}
