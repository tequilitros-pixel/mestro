"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleProductActiveAction, updateProductCategoryAction } from "./actions";
import { PRODUCT_CATEGORIES } from "./categories";
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

export default function ProductsList({ products: initialProducts }: { products: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [syncedProducts, setSyncedProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null);

  if (initialProducts !== syncedProducts) {
    setSyncedProducts(initialProducts);
    setProducts(initialProducts);
  }

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }

    const categoriesWithProducts = PRODUCT_CATEGORIES.filter((c) => counts.has(c));

    return [
      { name: "Todos", count: products.length },
      ...categoriesWithProducts.map((c) => ({ name: c, count: counts.get(c) ?? 0 })),
    ];
  }, [products]);

  const filtered = products.filter((p) => {
    if (activeTab !== "Todos" && p.category !== activeTab) return false;

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

  async function handleCategoryChange(id: string, category: string) {
    const previous = products;
    setCategorySavingId(id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, category } : p)));

    const response = await updateProductCategoryAction(id, category);

    setCategorySavingId(null);

    if (!response.success) {
      setProducts(previous);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-outline-variant">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab.name
                ? "border-primary text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.name}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.name
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, código o categoría..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
      />

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        <div className="hidden grid-cols-[1fr_2fr_1.2fr_1fr_1fr_auto] gap-3 border-b border-outline-variant px-4 py-3 text-xs font-medium text-outline md:grid">
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
            className="grid gap-2 border-b border-outline-variant px-4 py-3 last:border-b-0 md:grid-cols-[1fr_2fr_1.2fr_1fr_1fr_auto] md:items-center"
          >
            <span className="text-sm text-on-surface-variant">{p.code}</span>
            <Link
              href={`/administration/inventory/products/${p.id}`}
              className={`font-medium hover:underline ${p.isActive ? "text-on-surface" : "text-outline"}`}
            >
              {p.name}
            </Link>

            <select
              value={p.category}
              disabled={categorySavingId === p.id}
              onChange={(e) => handleCategoryChange(p.id, e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

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
