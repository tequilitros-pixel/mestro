"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { generateClientOperationId } from "@/lib/pos2/offline/canonical";
import { getInventoryCaptureDescriptor, getPiecePresentationSize, formatCommercialPresentation } from "@/lib/inventory/units";
import { createWeeklyInventoryReceiptAction, type ActionResult } from "../actions";

export type WeeklyProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: number | null;
  contentUnit: string | null;
  normalizedContentPerUnit: number | null;
};

type Branch = { id: string; name: string };
type RowValue = { quantity: string; loosePieces: string };

const numberInputStyle = {
  color: "var(--color-on-surface)",
  WebkitTextFillColor: "var(--color-on-surface)",
  caretColor: "var(--color-primary)",
  opacity: 1,
};

function focusNextInput(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-weekly-entry-input]"));
  const currentIndex = inputs.indexOf(event.currentTarget);
  inputs[currentIndex + 1]?.focus();
}

export default function WeeklyEntryForm({
  branches,
  products,
}: {
  branches: Branch[];
  products: WeeklyProduct[];
}) {
  const [values, setValues] = useState<Record<string, RowValue>>({});
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const operationId = useRef<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort((a, b) => a.localeCompare(b, "es")),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    return products.filter((product) => {
      const searchable = `${product.name} ${product.code} ${product.category}`.toLocaleLowerCase("es-MX");
      return (!category || product.category === category) && (!query || searchable.includes(query));
    });
  }, [category, products, search]);

  const capturedCount = Object.values(values).filter((value) => value.quantity.trim() !== "" || value.loosePieces.trim() !== "").length;

  function updateValue(productId: string, key: keyof RowValue, value: string) {
    setValues((current) => ({
      ...current,
      [productId]: { quantity: current[productId]?.quantity ?? "", loosePieces: current[productId]?.loosePieces ?? "", [key]: value },
    }));
  }

  async function handleSubmit(formData: FormData) {
    const items = products.flatMap((product) => {
      const value = values[product.id];
      if (!value || (value.quantity.trim() === "" && value.loosePieces.trim() === "")) return [];
      const descriptor = getInventoryCaptureDescriptor(0, product);
      const packageSize = getPiecePresentationSize(product);
      const hasPositiveQuantity = Number(value.quantity || 0) > 0 || Number(value.loosePieces || 0) > 0;
      if (!hasPositiveQuantity) return [];
      return [{
        productId: product.id,
        quantity: value.quantity.trim() || (packageSize !== null ? "0" : ""),
        ...(packageSize !== null && value.loosePieces.trim() !== "" ? { loosePieces: value.loosePieces.trim() } : {}),
        captureUnit: descriptor.captureUnit,
      }];
    }).filter((item) => item.quantity !== "");

    setSaving(true);
    setResult(null);
    operationId.current ??= generateClientOperationId();
    formData.set("branchId", branchId);
    formData.set("items", JSON.stringify(items));
    formData.set("operationId", operationId.current);
    try {
      const response = await createWeeklyInventoryReceiptAction(formData);
      setResult(response);
      if (response.success) {
        operationId.current = null;
        setValues({});
      }
    } catch {
      setResult({ success: false, error: "No se pudo confirmar la entrada. Revisa tu conexión y vuelve a intentar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      {result && (
        <div className={`rounded-xl border p-4 text-sm ${result.success ? "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim" : "border-error/40 bg-error/10 text-error"}`} role="status" aria-live="polite">
          {result.success ? result.message : result.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
          <select name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} required className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none focus:border-primary">
            <option value="" disabled>Selecciona una sucursal</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Nota de la entrada</span>
          <input name="notes" placeholder="Ej. Surtido semanal · 12 de octubre" maxLength={500} className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary" />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o código…" className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none focus:border-primary sm:max-w-xs">
          <option value="">Todas las categorías</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant">
        <span>{visibleProducts.length} productos visibles · {capturedCount} con cantidad capturada</span>
        <span>Presiona Enter para avanzar al siguiente campo.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_11rem] gap-3 border-b border-outline-variant bg-surface-container-high px-4 py-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <span>Producto</span>
            <span>Categoría</span>
            <span>Cantidad</span>
          </div>
          {visibleProducts.map((product) => {
            const value = values[product.id] ?? { quantity: "", loosePieces: "" };
            const descriptor = getInventoryCaptureDescriptor(0, product);
            const packageSize = getPiecePresentationSize(product);
            const presentation = formatCommercialPresentation(product);
            const loosePiecesLabel = product.name.toLocaleLowerCase("es-MX").includes("vaso")
              ? "Vasos sueltos"
              : "Piezas sueltas";
            const pieceUnitLabel = loosePiecesLabel.startsWith("Vasos") ? "vasos" : "piezas";
            return (
              <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_9rem_11rem] items-center gap-3 border-b border-outline-variant px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-on-surface">{product.name}</p>
                  <p className="truncate text-xs text-on-surface-variant">{product.code}{presentation ? ` · ${presentation}` : ` · ${product.unit}`}</p>
                </div>
                <span className="truncate text-sm text-on-surface-variant">{product.category}</span>
                {packageSize !== null ? (
                  <fieldset className="grid grid-cols-2 gap-2" aria-label={`Captura de ${product.name}`}>
                    <label className="space-y-1" htmlFor={`weekly-${product.id}`}>
                      <span className="block text-[11px] font-semibold text-on-surface">Paquetes completos</span>
                      <span className="block text-[10px] text-on-surface-variant">De {packageSize} {pieceUnitLabel}</span>
                      <input id={`weekly-${product.id}`} data-weekly-entry-input type="number" inputMode="numeric" min="0" step="1" value={value.quantity} onChange={(event) => updateValue(product.id, "quantity", event.target.value)} onKeyDown={focusNextInput} placeholder="0" className="w-full rounded-lg border border-outline-variant bg-background px-2 py-2.5 text-sm text-on-surface outline-none focus:border-primary" style={numberInputStyle} />
                    </label>
                    <label className="space-y-1" htmlFor={`weekly-loose-${product.id}`}>
                      <span className="block text-[11px] font-semibold text-on-surface">{loosePiecesLabel}</span>
                      <span className="block text-[10px] text-on-surface-variant">De 0 a {packageSize - 1}</span>
                      <input id={`weekly-loose-${product.id}`} data-weekly-entry-input type="number" inputMode="numeric" min="0" max={packageSize - 1} step="1" value={value.loosePieces} onChange={(event) => updateValue(product.id, "loosePieces", event.target.value)} onKeyDown={focusNextInput} placeholder="0" className="w-full rounded-lg border border-outline-variant bg-background px-2 py-2.5 text-sm text-on-surface outline-none focus:border-primary" style={numberInputStyle} />
                    </label>
                  </fieldset>
                ) : (
                  <label className="relative">
                    <span className="sr-only">Cantidad de {product.name}</span>
                    <input data-weekly-entry-input type="number" min="0" step="0.001" inputMode="decimal" value={value.quantity} onChange={(event) => updateValue(product.id, "quantity", event.target.value)} onKeyDown={focusNextInput} placeholder="0" className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2.5 pr-14 text-sm text-on-surface outline-none focus:border-primary" style={numberInputStyle} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-on-surface-variant">{descriptor.unitLabel}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-5 text-on-surface-variant">
          Se registra como compra en lote. La operación es atómica: si un producto tiene un problema, no se guarda sólo una parte.
        </p>
        <button type="submit" disabled={saving || !branchId} className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar entrada semanal"}
        </button>
      </div>
    </form>
  );
}
