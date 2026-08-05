"use client";

import { useState } from "react";
import {
  createInventoryProductAction,
  type CreateInventoryProductResult,
} from "./actions";

const categories = [
  "Tequila",
  "Licores",
  "Refrescos",
  "Ingredientes",
  "Trastes",
  "Vasos",
  "Equipo de stand",
  "Herramientas",
];


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

type EventPackage = { id: string; name: string };

export default function ProductForm({
  packages,
}: {
  packages: EventPackage[];
}) {
  const [result, setResult] = useState<CreateInventoryProductResult | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);

  function togglePackage(id: string) {
    setSelectedPackages((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

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
      setSelectedPackages([]);
    }
  }

  return (
    <form
      id="inventory-product-form"
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div>
        <h2 className="text-xl font-bold text-on-surface">Nuevo producto</h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Registra bebidas, insumos, herramientas o equipo.
        </p>
      </div>

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

            {categories.map((category) => (
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
            name="unit"
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

      {packages.length > 0 && (
        <div className="space-y-3 rounded-xl border border-outline-variant bg-background p-4">
          <p className="text-sm font-semibold text-on-surface-variant">
            ¿En qué paquetes de eventos se usa?
          </p>
          <p className="text-xs text-outline">
            Se agregará automáticamente a los paquetes que selecciones.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {packages.map((pkg) => {
              const checked = selectedPackages.includes(pkg.id);
              return (
                <div
                  key={pkg.id}
                  className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2"
                >
                  <input
                    type="checkbox"
                    name="packages"
                    value={pkg.id}
                    checked={checked}
                    onChange={() => togglePackage(pkg.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-sm text-on-surface-variant">
                    {pkg.name}
                  </span>
                  {checked && (
                    <input
                      name={`quantity-${pkg.id}`}
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue="1"
                      className="w-20 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
