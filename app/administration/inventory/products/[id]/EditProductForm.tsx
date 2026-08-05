"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateInventoryProductAction,
  deleteInventoryProductAction,
  type CreateInventoryProductResult,
} from "../actions";

const categories = [
  "Tequila", "Licores", "Refrescos", "Ingredientes",
  "Trastes", "Vasos", "Equipo de stand", "Herramientas",
];


const units = [
  "Pieza", "Botella", "Caja", "Bolsa", "Litro", "Mililitro",
  "Kilogramo", "Gramo", "Metro", "Paquete",
];

type Product = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  itemType: string;
  unitCost: number | null;
  minimumStock: number;
  trackStock: boolean;
  trackBatch: boolean;
  trackExpiration: boolean;
  canBeSold: boolean;
  mustReturn: boolean;
};

export default function EditProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [result, setResult] = useState<CreateInventoryProductResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await updateInventoryProductAction(product.id, formData);

    setResult(response);
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    const response = await deleteInventoryProductAction(product.id);

    if (response.success) {
      router.push("/administration/inventory/products");
    } else {
      setDeleteError(response.error);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        action={handleSubmit}
        className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
      >
        <div>
          <h2 className="text-xl font-bold text-on-surface">Editar producto</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Código: {product.code}</p>
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
            <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
            <input
              name="name"
              required
              defaultValue={product.name}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Categoría</span>
            <select
              name="category"
              required
              defaultValue={product.category}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Unidad de medida</span>
            <select
              name="unit"
              required
              defaultValue={product.unit}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Tipo de producto</span>
            <select
              name="itemType"
              required
              defaultValue={product.itemType}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="CONSUMABLE">Consumible</option>
              <option value="RETURNABLE">Retornable</option>
              <option value="EQUIPMENT">Equipo</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Costo unitario</span>
            <input
              name="unitCost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.unitCost ?? ""}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Existencia mínima</span>
            <input
              name="minimumStock"
              type="number"
              min="0"
              step="0.001"
              defaultValue={product.minimumStock}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Descripción</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={product.description ?? ""}
            className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["trackStock", "Controlar existencias", product.trackStock],
            ["trackBatch", "Manejar lote", product.trackBatch],
            ["trackExpiration", "Manejar caducidad", product.trackExpiration],
            ["canBeSold", "Se puede vender", product.canBeSold],
            ["mustReturn", "Debe regresar", product.mustReturn],
          ].map(([name, label, checked]) => (
            <label
              key={name as string}
              className="flex items-center gap-3 rounded-xl border border-outline-variant bg-background px-4 py-3"
            >
              <input
                name={name as string}
                type="checkbox"
                defaultChecked={checked as boolean}
                className="h-4 w-4"
              />
              <span className="text-sm text-on-surface-variant">{label as string}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div className="rounded-2xl border border-error/40 bg-error/10 p-6">
        <h3 className="font-bold text-error">Eliminar producto</h3>
        <p className="mt-1 text-sm text-error/70">
          Solo se puede eliminar si nunca se ha usado en paquetes, eventos, kits o movimientos.
        </p>

        {deleteError && (
          <div className="mt-3 rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
            {deleteError}
          </div>
        )}

        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="mt-4 rounded-xl border border-error/40 px-4 py-2 text-sm font-semibold text-error transition duration-150 ease-out hover:scale-[1.04] hover:bg-error/10 active:scale-[0.97]"
          >
            Eliminar producto
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-error">¿Confirmas eliminar? No se puede deshacer.</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
            >
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-sm text-on-surface-variant hover:text-on-surface-variant"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
