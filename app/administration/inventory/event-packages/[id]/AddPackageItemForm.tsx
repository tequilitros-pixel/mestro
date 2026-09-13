"use client";

import { useState } from "react";
import { addEventPackageItemAction, type ActionResult } from "../actions";

type Product = { id: string; name: string; unit: string };

export default function AddPackageItemForm({
  packageId,
  products,
  title,
}: {
  packageId: string;
  products: Product[];
  title: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [calcType, setCalcType] = useState("FIXED");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await addEventPackageItemAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        `add-item-form-${title}`,
      ) as HTMLFormElement | null;
      form?.reset();
      setCalcType("FIXED");
    }
  }

  return (
    <form
      id={`add-item-form-${title}`}
      action={handleSubmit}
      className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <input type="hidden" name="packageId" value={packageId} />
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>

      {result && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            result.success
              ? "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim"
              : "border-error/40 bg-error/10 text-error"
          }`}
        >
          {result.success ? result.message : result.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Producto</span>
          <select
            name="productId"
            required
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              Selecciona un producto
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Tipo de cálculo</span>
          <select
            name="calculationType"
            value={calcType}
            onChange={(e) => setCalcType(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="FIXED">Cantidad fija</option>
            <option value="PER_GUEST">Por invitado</option>
            <option value="PER_GUEST_BLOCK">Por bloque de invitados</option>
            <option value="MANUAL">Manual (se define al crear el evento)</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Cantidad</span>
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.001"
            required
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        {calcType === "PER_GUEST_BLOCK" && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">
              Invitados por bloque
            </span>
            <input
              name="guestsPerBlock"
              type="number"
              min="1"
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>
        )}
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-background px-4 py-3">
        <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4" />
        <span className="text-sm text-on-surface-variant">Obligatorio en este paquete</span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Agregando..." : "Agregar al paquete"}
      </button>
    </form>
  );
}
