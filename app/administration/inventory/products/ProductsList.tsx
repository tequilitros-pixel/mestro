"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleProductActiveAction } from "./actions";
import Link from "next/link";


type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number | null;
  itemType: string;
  isActive: boolean;
};

const itemTypeLabels: Record<string, string> = {
  CONSUMABLE: "Consumible",
  RETURNABLE: "Retornable",
  EQUIPMENT: "Equipo",
};

export default function ProductsList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  async function handleToggle(id: string, current: boolean) {
    setLoadingId(id);
    await toggleProductActiveAction(id, !current);
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar por nombre, código o categoría..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
      />

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        <div className="hidden grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-3 border-b border-outline-variant px-4 py-3 text-xs font-medium text-outline md:grid">
          <span>Código</span>
          <span>Nombre</span>
          <span>Categoría</span>
          <span>Tipo</span>
          <span>Costo</span>
          <span>Estado</span>
        </div>

        {filtered.length === 0 && (
          <p className="p-6 text-sm text-on-surface-variant">No se encontraron productos.</p>
        )}

        {filtered.map((p) => (
          <div
            key={p.id}
            className="grid gap-2 border-b border-outline-variant px-4 py-3 last:border-b-0 md:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] md:items-center"
          >
            <span className="text-sm text-on-surface-variant">{p.code}</span>
           <Link
  href={`/administration/inventory/products/${p.id}`}
  className={`font-medium hover:underline ${p.isActive ? "text-on-surface" : "text-outline"}`}
>
  {p.name}
</Link>

            <span className="text-sm text-on-surface-variant">{p.category}</span>
            <span className="text-sm text-on-surface-variant">{itemTypeLabels[p.itemType]}</span>
            <span className="text-sm text-on-surface-variant">
              {p.unitCost !== null ? `$${p.unitCost.toFixed(2)}` : "—"}
            </span>
            <button
              onClick={() => handleToggle(p.id, p.isActive)}
              disabled={loadingId === p.id}
              className={`w-fit rounded-full px-3 py-1 text-xs font-medium transition ${
                p.isActive
                  ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim hover:bg-error/20 hover:text-error"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-tertiary-fixed-dim/20 hover:text-tertiary-fixed-dim"
              }`}
            >
              {loadingId === p.id ? "..." : p.isActive ? "Activo" : "Inactivo"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
