"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveInventoryProductAction,
  restoreInventoryProductAction,
  toggleProductActiveAction,
  updateProductCategoryAction,
} from "./actions";
import { PRODUCT_CATEGORIES } from "./categories";
import Link from "next/link";
import { getInventoryProductState } from "@/lib/inventory/productState";
import { inventoryCountFrequencyLabel } from "@/lib/inventory/countScope";


type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number | null;
  itemType: string;
  countFrequency: "UNCLASSIFIED" | "WEEKLY" | "MONTHLY_ONLY";
  isActive: boolean;
  archivedAt: string | null;
};

const itemTypeLabels: Record<string, string> = {
  CONSUMABLE: "Consumible",
  RETURNABLE: "Retornable",
  EQUIPMENT: "Equipo",
};

export default function ProductsList({ products: initialProducts, readOnly = false }: { products: Product[]; readOnly?: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [syncedProducts, setSyncedProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [categorySavingId, setCategorySavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

    const statusTabs = [
      { name: "Activos", count: products.filter((p) => getInventoryProductState(p) === "ACTIVE").length },
      { name: "Inactivos", count: products.filter((p) => getInventoryProductState(p) === "INACTIVE").length },
      { name: "Archivados", count: products.filter((p) => getInventoryProductState(p) === "ARCHIVED").length },
    ];
    const frequencyTabs = [
      { name: "Conteo semanal", count: products.filter((p) => p.countFrequency === "WEEKLY").length },
      { name: "Sólo mensual", count: products.filter((p) => p.countFrequency === "MONTHLY_ONLY").length },
      { name: "Pendientes", count: products.filter((p) => p.countFrequency === "UNCLASSIFIED").length },
    ];

    return [
      { name: "Todos", count: products.length },
      ...statusTabs,
      ...frequencyTabs,
      ...categoriesWithProducts.map((c) => ({ name: c, count: counts.get(c) ?? 0 })),
    ];
  }, [products]);

  const filtered = products.filter((p) => {
    if (activeTab === "Activos" && getInventoryProductState(p) !== "ACTIVE") return false;
    if (activeTab === "Inactivos" && getInventoryProductState(p) !== "INACTIVE") return false;
    if (activeTab === "Archivados" && getInventoryProductState(p) !== "ARCHIVED") return false;
    if (activeTab === "Conteo semanal" && p.countFrequency !== "WEEKLY") return false;
    if (activeTab === "Sólo mensual" && p.countFrequency !== "MONTHLY_ONLY") return false;
    if (activeTab === "Pendientes" && p.countFrequency !== "UNCLASSIFIED") return false;
    if (!["Todos", "Activos", "Inactivos", "Archivados", "Conteo semanal", "Sólo mensual", "Pendientes"].includes(activeTab) && p.category !== activeTab) return false;

    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  });

  async function handleToggle(id: string, current: boolean) {
    setActionError(null);
    setLoadingId(id);
    const response = await toggleProductActiveAction(id, !current);
    setLoadingId(null);
    if (!response.success) setActionError(response.error);
    router.refresh();
  }

  async function handleArchive(id: string) {
    setActionError(null);
    setLoadingId(id);
    let response = await archiveInventoryProductAction(id);
    if (!response.success && response.requiresConfirmation) {
      const confirmed = window.confirm(response.error);
      if (confirmed) response = await archiveInventoryProductAction(id, true);
    }
    setLoadingId(null);
    if (!response.success) {
      setActionError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleRestore(id: string) {
    setActionError(null);
    setLoadingId(id);
    const response = await restoreInventoryProductAction(id);
    setLoadingId(null);
    if (!response.success) {
      setActionError(response.error);
      return;
    }
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
      {actionError && (
        <div role="alert" className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {actionError}
        </div>
      )}
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
        <div className="hidden grid-cols-[1fr_2fr_1.2fr_1fr_1fr_1.25fr_auto] gap-3 border-b border-outline-variant px-4 py-3 text-xs font-medium text-outline md:grid">
          <span>Código</span>
          <span>Nombre</span>
          <span>Categoría</span>
          <span>Tipo</span>
          <span>Conteo</span>
          <span>Costo</span>
          <span>Estado</span>
        </div>

        {filtered.length === 0 && (
          <p className="p-6 text-sm text-on-surface-variant">No se encontraron productos.</p>
        )}

        {filtered.map((p) => (
          <div
            key={p.id}
            className={`grid gap-2 border-b border-outline-variant px-4 py-3 last:border-b-0 md:grid-cols-[1fr_2fr_1.2fr_1fr_1fr_1.25fr_auto] md:items-center ${p.archivedAt ? "bg-surface-container-high/40" : ""}`}
          >
            <span className="text-sm text-on-surface-variant">{p.code}</span>
            <Link
              href={`/administration/inventory/products/${p.id}`}
              className={`font-medium hover:underline ${p.archivedAt ? "text-outline" : p.isActive ? "text-on-surface" : "text-outline"}`}
            >
              {p.name}
            </Link>

            {readOnly ? <span className="text-sm text-on-surface-variant">{p.category}</span> : <select
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
            </select>}

            <span className="text-sm text-on-surface-variant">{itemTypeLabels[p.itemType]}</span>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${p.countFrequency === "UNCLASSIFIED" ? "bg-secondary/15 text-secondary" : "bg-surface-container-high text-on-surface-variant"}`}>
              {inventoryCountFrequencyLabel(p.countFrequency)}
            </span>
            <span className="text-sm text-on-surface-variant">
              {p.unitCost !== null ? `$${p.unitCost.toFixed(2)}` : "—"}
            </span>
            {readOnly ? (
              <span className="w-fit rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                {getInventoryProductState(p) === "ARCHIVED" ? "Archivado" : p.isActive ? "Activo" : "Inactivo"}
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {p.archivedAt ? (
                  <button
                    onClick={() => handleRestore(p.id)}
                    disabled={loadingId === p.id}
                    className="w-fit rounded-full bg-secondary/15 px-3 py-1 text-xs font-medium text-secondary transition hover:bg-secondary/25 disabled:opacity-60"
                  >
                    {loadingId === p.id ? "..." : "Restaurar"}
                  </button>
                ) : (
                  <>
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
                    <button
                      onClick={() => handleArchive(p.id)}
                      disabled={loadingId === p.id}
                      className="w-fit rounded-full border border-outline-variant px-3 py-1 text-xs font-medium text-on-surface-variant transition hover:border-error/40 hover:text-error disabled:opacity-60"
                    >
                      Archivar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
