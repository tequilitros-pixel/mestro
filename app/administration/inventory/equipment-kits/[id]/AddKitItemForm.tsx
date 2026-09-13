"use client";

import { useState } from "react";
import { addEquipmentKitItemAction, type ActionResult } from "../actions";

type Product = { id: string; name: string; unit: string };

export default function AddKitItemForm({
  kitId,
  products,
}: {
  kitId: string;
  products: Product[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await addEquipmentKitItemAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        "add-kit-item-form",
      ) as HTMLFormElement | null;
      form?.reset();
    }
  }

  return (
    <form
      id="add-kit-item-form"
      action={handleSubmit}
      className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <input type="hidden" name="kitId" value={kitId} />
      <h3 className="text-lg font-bold text-on-surface">Agregar equipo al kit</h3>

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
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-background px-4 py-3">
        <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4" />
        <span className="text-sm text-on-surface-variant">Obligatorio en este kit</span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Agregando..." : "Agregar al kit"}
      </button>
    </form>
  );
}
