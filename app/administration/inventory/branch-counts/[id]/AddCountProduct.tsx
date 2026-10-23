"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addInventoryCountProductAction } from "../actions";

export default function AddCountProduct({
  countId,
  products,
}: {
  countId: string;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!productId || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await addInventoryCountProductAction(countId, productId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("No fue posible agregar el producto al conteo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h2 className="font-semibold">Agregar producto faltante</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Agrega un producto del alcance del conteo. Su cantidad quedará pendiente hasta que la captures.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-col gap-1 text-sm">
          Producto
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            disabled={saving}
            className="rounded-xl border border-outline-variant bg-surface px-3 py-2"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !productId}
          className="rounded-xl bg-tertiary-fixed-dim px-4 py-2 font-semibold text-on-surface disabled:opacity-60"
        >
          {saving ? "Agregando..." : "Agregar al conteo"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </div>
  );
}
