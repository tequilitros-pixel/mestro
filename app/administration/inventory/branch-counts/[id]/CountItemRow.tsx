"use client";

import { useState } from "react";
import { updateCountItemQuantityAction, updateCountItemNotesAction } from "../actions";
import { CheckIcon, AlertIcon, PencilIcon, XIcon } from "@/components/ui/icons";
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

const QUICK_MERMA_REASONS = [
  "🍾 Botella / envase roto",
  "⏳ Caducado",
  "🍸 Degustación / cortesía",
  "⚠️ Merma operativa",
  "❓ Faltante por investigar",
  "✨ Sobrante no registrado",
];

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
  onItemUpdated,
}: {
  item: Item;
  countId: string;
  editable: boolean;
  onItemUpdated?: (updated: Item) => void;
}) {
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
  const [savedInputs, setSavedInputs] = useState(() => ({
    quantity: getInventoryCountInputValue(item),
    packages: packageInputs?.packages ?? "",
    loosePieces: packageInputs?.loosePieces ?? "",
  }));
  const [notes, setNotes] = useState(() => item.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(() => item.notes ?? "");
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = isPiecePackage
    ? packages !== savedInputs.packages || loosePieces !== savedInputs.loosePieces
    : quantity !== savedInputs.quantity;

  async function handleSave(overrideValues?: { quantity?: string; packages?: string; loosePieces?: string }) {
    if (saving) return;
    const submittedQuantity = overrideValues?.quantity ?? quantity;
    const submittedPackages = overrideValues?.packages ?? packages;
    const submittedLoosePieces = overrideValues?.loosePieces ?? loosePieces;

    const submitted = {
      quantity: submittedQuantity,
      packages: submittedPackages,
      loosePieces: submittedLoosePieces,
    };
    setSaving(true);
    try {
      const result = await updateCountItemQuantityAction({
        itemId: item.id,
        countId,
        quantity: isPiecePackage ? submitted.packages.trim() : submitted.quantity.trim(),
        loosePieces: isPiecePackage ? submitted.loosePieces.trim() : undefined,
        captureUnit: capture.captureUnit,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        setSavedInputs(submitted);
        setSavedNotes(notes);
        if (overrideValues?.quantity !== undefined) setQuantity(overrideValues.quantity);
        if (overrideValues?.packages !== undefined) setPackages(overrideValues.packages);
        if (overrideValues?.loosePieces !== undefined) setLoosePieces(overrideValues.loosePieces);

        const newBase = result.baseQuantity ? Number(result.baseQuantity) : item.quantityCounted;
        onItemUpdated?.({
          ...item,
          quantityCounted: newBase,
          isCaptured: true,
          notes: notes.trim() || null,
        });

        showToast(
          isPiecePackage
            ? "Cantidad guardada: paquetes y piezas sueltas."
            : `Cantidad guardada: ${submitted.quantity.trim()} ${capture.unitLabel}.`,
        );
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("No fue posible guardar la cantidad. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickZero() {
    if (isPiecePackage) {
      setPackages("0");
      setLoosePieces("0");
      await handleSave({ packages: "0", loosePieces: "0" });
    } else {
      setQuantity("0");
      await handleSave({ quantity: "0" });
    }
  }

  async function handleSaveNotes() {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      const result = await updateCountItemNotesAction(countId, item.id, notes);
      if (result.success) {
        setSavedNotes(notes);
        setShowNotesEditor(false);
        onItemUpdated?.({
          ...item,
          notes: notes.trim() || null,
        });
        showToast("Justificación / merma guardada.");
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("No fue posible guardar la justificación.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleRemoveNotes() {
    setNotes("");
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      const result = await updateCountItemNotesAction(countId, item.id, "");
      if (result.success) {
        setSavedNotes("");
        setShowNotesEditor(false);
        onItemUpdated?.({
          ...item,
          notes: null,
        });
        showToast("Justificación eliminada.");
      } else {
        showToast(result.error);
      }
    } catch {
      showToast("No fue posible eliminar la justificación.");
    } finally {
      setSavingNotes(false);
    }
  }

  // Diferencia calculable si se conoce previousQuantity
  const differenceKnown = item.previousQuantity !== undefined;
  const theoretical = item.previousQuantity ?? 0;
  const difference = differenceKnown && item.isCaptured
    ? item.quantityCounted - theoretical
    : null;

  const historyVisible = !editable && differenceKnown;
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
    <div
      data-count-dirty={editable && dirty ? "true" : undefined}
      className={`border-b border-outline-variant p-4 transition-colors ${
        editable && !item.isCaptured ? "bg-secondary/5" : "hover:bg-surface-container-high/40"
      }`}
    >
      <div className="grid gap-3 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] md:items-center">
        {/* Columna Producto */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface">{item.productName}</p>
            {item.productCategory && (
              <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                {item.productCategory}
              </span>
            )}
            {editable && (
              item.isCaptured ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckIcon className="h-3 w-3" /> Contado
                </span>
              ) : (
                <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-semibold text-secondary">
                  Pendiente
                </span>
              )
            )}
          </div>

          <p className="mt-1 text-xs text-on-surface-variant">{presentation}</p>
          {captureHint && <p className="mt-0.5 text-[11px] text-on-surface-variant/80">{captureHint}</p>}

          {/* Badge de Justificación / Merma si existe */}
          {savedNotes && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              <AlertIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="font-medium">Merma / Nota:</span>
              <span className="truncate max-w-[200px] sm:max-w-xs">{savedNotes}</span>
              {editable && (
                <button
                  type="button"
                  onClick={() => setShowNotesEditor(true)}
                  className="ml-1 text-amber-200 hover:text-white"
                  title="Editar justificación"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Estado de guardado en edición */}
          {editable && (
            <p className={`mt-1 text-xs font-semibold ${dirty ? "text-error" : "text-on-surface-variant"}`}>
              {saving ? "Guardando…" : dirty ? "Cambio sin guardar" : item.isCaptured ? "Guardado" : "Pendiente de captura"}
            </p>
          )}

          {/* Botón rápido para justificar merma si editable y no tiene nota */}
          {editable && !savedNotes && !showNotesEditor && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowNotesEditor(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-on-surface-variant hover:text-primary transition"
              >
                + Registrar merma o justificación
              </button>
            </div>
          )}
        </div>

        {/* Columna Captura o Valores */}
        {editable ? (
          <div className="col-span-1 md:col-span-3">
            {isPiecePackage ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
                className="space-y-2"
              >
                <div className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2">
                  <label className="space-y-1" htmlFor={`count-packages-${item.id}`}>
                    <span className="block text-xs font-semibold text-on-surface">Paquetes</span>
                    <span className="block text-[10px] text-on-surface-variant">Cerrados</span>
                    <input
                      id={`count-packages-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={packages}
                      disabled={saving}
                      onChange={(event) => setPackages(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      style={countNumberInputStyle}
                    />
                  </label>

                  <label className="space-y-1" htmlFor={`count-loose-${item.id}`}>
                    <span className="block text-xs font-semibold text-on-surface">{loosePiecesLabel}</span>
                    <span className="block text-[10px] text-on-surface-variant">0 a {packageSize - 1}</span>
                    <input
                      id={`count-loose-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={packageSize - 1}
                      step="1"
                      value={loosePieces}
                      disabled={saving}
                      onChange={(event) => setLoosePieces(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2.5 text-sm font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      style={countNumberInputStyle}
                    />
                  </label>

                  {/* Botón rápido poner en 0 */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleQuickZero}
                    title="Marcar 0 paquetes y 0 sueltas"
                    className="h-10 rounded-xl border border-outline-variant bg-surface-container-high px-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface active:scale-95 disabled:opacity-50 transition"
                  >
                    0
                  </button>

                  {/* Botón guardar */}
                  <button
                    type="submit"
                    disabled={saving || (!dirty && item.isCaptured)}
                    className="flex h-10 items-center justify-center gap-1 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-40 transition"
                  >
                    <CheckIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Guardar</span>
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Ejemplo: 17 paq. + 5 {loosePiecesLabel.toLocaleLowerCase("es-MX")} = {17 * packageSize + 5} {pieceUnitLabel}.
                </p>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
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
                    disabled={saving}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 pr-14 text-sm font-semibold text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                    style={countNumberInputStyle}
                  />
                  <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-on-surface-variant"
                    aria-hidden="true"
                  >
                    {capture.unitLabel}
                  </span>
                </div>

                {/* Botón rápido poner en 0 */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleQuickZero}
                  title="Marcar 0 al instante"
                  className="h-10 rounded-xl border border-outline-variant bg-surface-container-high px-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface active:scale-95 disabled:opacity-50 transition"
                >
                  0
                </button>

                {/* Botón guardar */}
                <button
                  type="submit"
                  disabled={saving || (!dirty && item.isCaptured)}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-40 transition"
                >
                  <CheckIcon className="h-4 w-4" />
                  <span>Guardar</span>
                </button>
              </form>
            )}

            {/* Vista previa de diferencia para administradores durante la captura */}
            {differenceKnown && item.isCaptured && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-on-surface-variant">Teórico: <strong>{formatCountQuantity(theoretical, item)}</strong></span>
                <span className="text-on-surface-variant">·</span>
                <span>Diferencia: </span>
                {difference === 0 ? (
                  <span className="font-semibold text-emerald-400">0 (Exacto)</span>
                ) : difference !== null && difference < 0 ? (
                  <span className="font-bold text-error">
                    {formatCountQuantity(difference, item)} (Faltante)
                  </span>
                ) : (
                  <span className="font-bold text-primary">
                    +{difference !== null ? formatCountQuantity(difference, item) : ""} (Sobrante)
                  </span>
                )}
                {difference !== null && difference < 0 && !savedNotes && (
                  <button
                    type="button"
                    onClick={() => setShowNotesEditor(true)}
                    className="text-amber-400 underline hover:text-amber-300 ml-1"
                  >
                    ¿Justificar merma?
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Modo solo lectura (Conteo cerrado) */
          <>
            <div>
              {historyVisible && (
                <>
                  <span className="block text-xs text-on-surface-variant">Teórico</span>
                  <p className="text-sm text-on-surface-variant">
                    {formatCountQuantity(theoretical, item)}
                  </p>
                </>
              )}
              <span className="mt-2 block text-xs text-on-surface-variant">Contado</span>
              <p className="text-sm font-semibold text-on-surface">
                {formatCountQuantity(item.quantityCounted, item)}
              </p>
            </div>

            {historyVisible && (
              <div>
                <span className="block text-xs text-on-surface-variant">Diferencia</span>
                <p
                  className={`text-sm font-bold ${
                    difference !== null && difference < 0
                      ? "text-error"
                      : difference !== null && difference > 0
                      ? "text-primary"
                      : "text-on-surface"
                  }`}
                >
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
                {item.costTotal !== undefined && item.costTotal !== null && item.costTotal > 0 && (
                  <p className="text-xs text-tertiary-fixed-dim">
                    ${item.costTotal.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Editor desplegable de merma / justificación */}
      {editable && showNotesEditor && (
        <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container p-3 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
              <AlertIcon className="h-4 w-4 text-amber-400" />
              <span>Justificación de merma o discrepancia</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNotesEditor(false)}
              className="text-on-surface-variant hover:text-on-surface"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[11px] text-on-surface-variant">
            Selecciona un motivo común o escribe una justificación para auditoría (ej. botellas rotas, merma, caducidad).
          </p>

          {/* Chips de motivos rápidos */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MERMA_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setNotes((prev) => (prev ? `${prev} · ${reason}` : reason));
                }}
                className="rounded-lg border border-outline-variant bg-background px-2.5 py-1 text-[11px] font-medium text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition active:scale-95"
              >
                {reason}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle de la merma o motivo del faltante..."
              className="flex-1 rounded-xl border border-outline-variant bg-background px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={savingNotes}
              onClick={handleSaveNotes}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50 transition"
            >
              {savingNotes ? "Guardando…" : "Guardar motivo"}
            </button>
            {savedNotes && (
              <button
                type="button"
                disabled={savingNotes}
                onClick={handleRemoveNotes}
                className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs font-semibold text-error hover:bg-error/20 disabled:opacity-50 transition"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}