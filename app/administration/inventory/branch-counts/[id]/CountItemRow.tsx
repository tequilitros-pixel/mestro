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
  getPiecePresentationSize,
} from "@/lib/inventory/units";
import {
  getInventoryCountInputValue,
  type InventoryCountItemClientView,
} from "@/lib/inventory/countPresentation";

type Item = InventoryCountItemClientView;

const countNumberInputStyle = {
  color: "var(--color-on-surface)",
  WebkitTextFillColor: "var(--color-on-surface)",
  caretColor: "var(--color-primary)",
  opacity: 1,
};

function formatCountQuantity(value: number, item: Item) {
  return formatCommercialQuantity(value, item);
}

function splitPackagesAndLoosePieces(item: Item, packageSize: number) {
  if (!item.isCaptured) return { packages: "", loosePieces: "" };

  const packages = Math.floor(item.quantityCounted / packageSize);
  const loosePieces = item.quantityCounted - packages * packageSize;
  return { packages: String(packages), loosePieces: String(loosePieces) };
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
  const packageSize = getPiecePresentationSize(item);
  const isPiecePackage = capture.captureUnit === "PRESENTATION" && packageSize !== null;
  const packageInputs = isPiecePackage
    ? splitPackagesAndLoosePieces(item, packageSize)
    : null;
  const [quantity, setQuantity] = useState(() =>
    getInventoryCountInputValue(item),
  );
  const [packages, setPackages] = useState(() => packageInputs?.packages ?? "");
  const [loosePieces, setLoosePieces] = useState(() => packageInputs?.loosePieces ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateCountItemQuantityAction({
      itemId: item.id,
      countId,
      quantity: isPiecePackage ? packages.trim() : quantity.trim(),
      loosePieces: isPiecePackage ? loosePieces.trim() : undefined,
      captureUnit: capture.captureUnit,
    });
    setSaving(false);

    if (result.success) {
      router.refresh();
      showToast(
        isPiecePackage
          ? "Cantidad guardada: paquetes y piezas sueltas."
          : `Cantidad guardada: ${quantity.trim()} ${capture.unitLabel}.`,
      );
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
  const loosePiecesLabel = item.productName.toLocaleLowerCase("es-MX").includes("vaso")
    ? "Vasos sueltos"
    : "Piezas sueltas";
  const pieceUnitLabel = loosePiecesLabel.startsWith("Vasos") ? "vasos" : "piezas";

  return (
    <div className={`grid gap-3 border-b border-outline-variant p-4 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] md:items-center ${editable && !item.isCaptured ? "bg-secondary/5" : ""}`}>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-on-surface">{item.productName}</p>
          {editable && !item.isCaptured && (
            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-secondary">
              Pendiente
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">{presentation}</p>
        {captureHint && <p className="mt-1 text-xs text-on-surface-variant">{captureHint}</p>}
      </div>

      {editable ? (
        isPiecePackage ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <label className="space-y-1" htmlFor={`count-packages-${item.id}`}>
              <span className="block text-xs font-semibold text-on-surface">Paquetes completos</span>
              <span className="block text-[11px] text-on-surface-variant">Solo paquetes cerrados</span>
              <input
                id={`count-packages-${item.id}`}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={packages}
                onChange={(event) => setPackages(event.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                style={countNumberInputStyle}
              />
            </label>
            <label className="space-y-1" htmlFor={`count-loose-${item.id}`}>
              <span className="block text-xs font-semibold text-on-surface">{loosePiecesLabel}</span>
              <span className="block text-[11px] text-on-surface-variant">De 0 a {packageSize - 1}, fuera de paquete</span>
              <input
                id={`count-loose-${item.id}`}
                type="number"
                inputMode="numeric"
                min="0"
                max={packageSize - 1}
                step="1"
                value={loosePieces}
                onChange={(event) => setLoosePieces(event.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-background px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                style={countNumberInputStyle}
              />
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-6 flex items-center justify-center rounded-lg bg-surface-container-high px-2 text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-60"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span className="sr-only">Guardar cantidad</span>
            </button>
            <p className="col-span-3 text-[11px] text-on-surface-variant">
              Ejemplo: 17 paquetes completos + 5 {loosePiecesLabel.toLocaleLowerCase("es-MX")} = {17 * packageSize + 5} {pieceUnitLabel}.
            </p>
          </div>
        ) : (
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
              style={countNumberInputStyle}
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
        )
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
