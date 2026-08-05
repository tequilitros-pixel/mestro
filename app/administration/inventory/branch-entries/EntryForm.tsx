"use client";

import { useState } from "react";
import { createInventoryEntryAction, type ActionResult } from "./actions";

type Branch = { id: string; name: string };
type Product = { id: string; name: string; unit: string };

export default function EntryForm({
  branches,
  products,
}: {
  branches: Branch[];
  products: Product[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("COMPRA");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createInventoryEntryAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById("entry-form") as HTMLFormElement | null;
      form?.reset();
    }
  }

  return (
    <form
      id="entry-form"
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div>
        <h2 className="text-xl font-bold text-on-surface">Registrar entrada o ajuste</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Compra que llegó a la sucursal, o un ajuste (merma, pérdida, corrección de conteo).
          Para mover stock entre sucursales usa{" "}
          <a
            href="/administration/inventory/sucursales/traspasos"
            className="font-semibold text-on-surface underline"
          >
            Traspasos
          </a>
          .
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
          <span className="text-sm font-semibold text-on-surface-variant">Sucursal</span>
          <select
            name="branchId"
            required
            defaultValue=""
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              Selecciona una sucursal
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

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
          <span className="text-sm font-semibold text-on-surface-variant">Tipo</span>
          <select
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="COMPRA">Compra</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </label>

        {type === "AJUSTE" && (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Sentido del ajuste</span>
            <select
              name="direction"
              required
              defaultValue="SUMA"
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            >
              <option value="SUMA">Suma stock</option>
              <option value="RESTA">Resta stock (merma, pérdida, robo)</option>
            </select>
          </label>
        )}

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

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Costo unitario</span>
          <input
            name="unitCost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Notas</span>
        <textarea
          name="notes"
          rows={2}
          className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar movimiento"}
      </button>
    </form>
  );
}
