"use client";

import { useState } from "react";
import {
  createInventoryProductAction,
  type CreateInventoryProductResult,
} from "./actions";
import { PRODUCT_CATEGORIES } from "./categories";

const units = [
  "Pieza",
  "Botella",
  "Caja",
  "Bolsa",
  "Litro",
  "Mililitro",
  "Kilogramo",
  "Gramo",
  "Metro",
  "Paquete",
];

export default function ProductForm({ onSuccess }: { onSuccess?: () => void; }) {
  const [result, setResult] = useState<CreateInventoryProductResult | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState(""); const [content, setContent] = useState(""); const [contentUnit, setContentUnit] = useState("ML");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createInventoryProductAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        "inventory-product-form",
      ) as HTMLFormElement | null;

      form?.reset();
      onSuccess?.();
    }
  }

  return (
    <form
      id="inventory-product-form"
      action={handleSubmit}
      className="space-y-6"
    >
      <p className="text-sm text-on-surface-variant">
        Registra bebidas, insumos, herramientas o equipo.
      </p>

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.success
              ? "border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 text-tertiary-fixed-dim"
              : "border-error/40 bg-error/10 text-error"
          }`}
        >
          {result.success ? result.message : result.error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Código</span>

          <input
            name="code"
            required
            placeholder="Ej. TEQ-BLA-001"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>

          <input
            name="name"
            required
            placeholder="Ej. Tequila blanco"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Categoría</span>

          <select
            name="category"
            required
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              Selecciona una categoría
            </option>

            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Unidad de medida
          </span>

          <select
            name="unit" value={unit} onChange={(event) => setUnit(event.target.value)}
            required
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              Selecciona una unidad
            </option>

            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2 md:col-span-2"><span className="text-sm font-semibold text-on-surface-variant">Contenido de cada unidad</span><div className="grid gap-3 sm:grid-cols-2"><input name="contentPerUnit" type="number" min="0.001" step="0.001" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ej. 600, 1800 o 1.8" className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm" /><select name="contentUnit" value={contentUnit} onChange={(event) => setContentUnit(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm"><option value="ML">ml</option><option value="L">L</option><option value="G">g</option><option value="KG">kg</option><option value="PIEZAS">piezas</option></select></div><p className="text-xs text-on-surface-variant">{content && unit ? `1 ${unit.toLowerCase()} contiene ${content} ${contentUnit === "PIEZAS" ? "piezas" : contentUnit.toLowerCase()}${contentUnit === "L" ? ` (${Number(content) * 1000} ml)` : ""}` : "Presentación sin configurar"}</p></div>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Tipo de producto
          </span>

          <select
            name="itemType"
            required
            defaultValue="CONSUMABLE"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="CONSUMABLE">Consumible</option>
            <option value="RETURNABLE">Retornable</option>
            <option value="EQUIPMENT">Equipo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Costo unitario
          </span>

          <input
            name="unitCost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Existencia mínima
          </span>

          <input
            name="minimumStock"
            type="number"
            min="0"
            step="0.001"
            defaultValue="0"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Descripción</span>

        <textarea
          name="description"
          rows={3}
          placeholder="Información adicional del producto"
          className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["trackStock", "Controlar existencias"],
          ["trackBatch", "Manejar lote"],
          ["trackExpiration", "Manejar caducidad"],
          ["canBeSold", "Se puede vender"],
          ["mustReturn", "Debe regresar"],
        ].map(([name, label]) => (
          <label
            key={name}
            className="flex items-center gap-3 rounded-xl border border-outline-variant bg-background px-4 py-3"
          >
            <input
              name={name}
              type="checkbox"
              defaultChecked={name === "trackStock"}
              className="h-4 w-4"
            />

            <span className="text-sm text-on-surface-variant">{label}</span>
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar producto"}
      </button>
    </form>
  );
}
