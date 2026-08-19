"use client";

import { useMemo, useState } from "react";
import { createInventoryEntryAction, type ActionResult } from "./actions";

type Branch = { id: string; name: string };
type Product = { id: string; code: string; name: string; category: string; unit: string };

export default function EntryForm({
  branches,
  products,
  canViewTransfers,
}: {
  branches: Branch[];
  products: Product[];
  canViewTransfers: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("COMPRA");
  const [productSearch, setProductSearch] = useState("");
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort((a, b) => a.localeCompare(b, "es")),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("es-MX");
    return products.filter((product) => {
      const matchesCategory = !category || product.category === category;
      const searchable = `${product.name} ${product.code} ${product.category}`.toLocaleLowerCase("es-MX");
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [category, productSearch, products]);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createInventoryEntryAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById("entry-form") as HTMLFormElement | null;
      form?.reset();
      setProductId("");
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
          {canViewTransfers && (
            <> Para mover stock entre sucursales usa{" "}<a href="/administration/inventory/sucursales/traspasos" className="font-semibold text-on-surface underline">Traspasos</a>.</>
          )}
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

        <div className="space-y-3 md:col-span-2">
          <span className="block text-sm font-semibold text-on-surface-variant">Producto</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="sr-only">Buscar producto</span>
              <input
                type="search"
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setProductId("");
                }}
                placeholder="Buscar por nombre o código…"
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </label>
            <label>
              <span className="sr-only">Filtrar por categoría</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setProductId("");
                }}
                className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                <option value="">Todas las categorías</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <select
            name="productId"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              {filteredProducts.length ? `Selecciona un producto (${filteredProducts.length})` : "No se encontraron productos"}
            </option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.code} ({p.unit})
              </option>
            ))}
          </select>
          <p className="text-xs text-on-surface-variant">
            {filteredProducts.length} de {products.length} productos visibles
            {category ? ` en ${category}` : ""}.
          </p>
        </div>

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
