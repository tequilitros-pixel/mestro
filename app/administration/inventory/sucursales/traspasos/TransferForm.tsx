"use client";

import { useState } from "react";
import { createTransferAction, type ActionResult } from "./actions";

type Branch = { id: string; name: string };
type Product = { id: string; name: string; unit: string };

export default function TransferForm({
  branches,
  products,
}: {
  branches: Branch[];
  products: Product[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createTransferAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById("transfer-form") as HTMLFormElement | null;
      form?.reset();
    }
  }

  return (
    <form
      id="transfer-form"
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      <div>
        <h2 className="text-xl font-bold text-on-surface">Registrar traspaso</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Mueve stock de una sucursal a otra. Se resta en el origen y se suma en el destino.
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
          <span className="text-sm font-semibold text-on-surface-variant">Sucursal origen</span>
          <select
            name="fromBranchId"
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
          <span className="text-sm font-semibold text-on-surface-variant">Sucursal destino</span>
          <select
            name="toBranchId"
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
        {saving ? "Guardando..." : "Registrar traspaso"}
      </button>
    </form>
  );
}
