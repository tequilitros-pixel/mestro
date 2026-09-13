"use client";

import { useMemo, useState } from "react";
import { createEventPackageAction, type ActionResult } from "./actions";

type Product = { id: string; code: string; name: string; category: string; unit: string };
export default function EventPackageForm({ products, onSuccess }: { products: Product[]; onSuccess?: () => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(""); const [category, setCategory] = useState(""); const [onlySelected, setOnlySelected] = useState(false); const [selected, setSelected] = useState<Record<string, string>>({});
  const visible = useMemo(() => products.filter((product) => (!category || product.category === category) && (!onlySelected || product.id in selected) && `${product.name} ${product.code}`.toLowerCase().includes(search.toLowerCase())), [products, category, onlySelected, search, selected]);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = await createEventPackageAction(formData);

    setResult(response);
    setSaving(false);

    if (response.success) {
      const form = document.getElementById(
        "event-package-form",
      ) as HTMLFormElement | null;
      form?.reset();
      onSuccess?.();
    }
  }

  return (
    <form
      id="event-package-form"
      action={handleSubmit}
      className="space-y-6"
    >
      <p className="text-sm text-on-surface-variant">
        Ej. Barra Chica, Barra Mediana, Barra Grande.
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
          <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
          <input
            name="name"
            required
            placeholder="Ej. Barra Chica (100 personas)"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Precio por persona</span>
          <input
            name="pricePerPerson"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Horas incluidas</span>
          <input
            name="includedHours"
            type="number"
            min="0"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Mínimo de invitados</span>
          <input
            name="minimumGuests"
            type="number"
            min="0"
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Descripción</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Qué incluye este paquete en general"
          className="resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </label>

      <input type="hidden" name="items" value={JSON.stringify(Object.entries(selected).map(([productId, quantity]) => ({ productId, quantity: Number(quantity) })))} />
      <section className="space-y-3 border-t border-outline-variant pt-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Productos del paquete</h3><p className="text-xs text-on-surface-variant">{Object.keys(selected).length} seleccionados</p></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />Solo seleccionados</label></div><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o código" className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant bg-background px-3 text-sm" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-lg border border-outline-variant bg-background px-3 text-sm"><option value="">Categoría</option>{[...new Set(products.map((product) => product.category))].map((value) => <option key={value}>{value}</option>)}</select></div><div className="max-h-72 overflow-auto rounded-xl border border-outline-variant"><table className="w-full text-left text-sm"><thead className="bg-surface-container-high text-xs text-on-surface-variant"><tr><th className="p-2">Seleccionar</th><th>Producto</th><th>Categoría</th><th>Unidad</th><th className="p-2">Cantidad</th></tr></thead><tbody>{visible.map((product) => { const checked = product.id in selected; return <tr key={product.id} className="h-12 border-t border-outline-variant"><td className="p-2"><input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => { const next = { ...current }; if (event.target.checked) next[product.id] = next[product.id] || "1"; else delete next[product.id]; return next; })} /></td><td>{product.name}<span className="ml-1 font-mono text-xs text-on-surface-variant">{product.code}</span></td><td>{product.category}</td><td>{product.unit}</td><td className="p-2"><input type="number" min="0.001" step="0.001" disabled={!checked} value={selected[product.id] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [product.id]: event.target.value }))} className="h-8 w-20 rounded border border-outline-variant bg-background px-2" /></td></tr>; })}</tbody></table></div></section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : "Guardar paquete"}
      </button>
    </form>
  );
}
