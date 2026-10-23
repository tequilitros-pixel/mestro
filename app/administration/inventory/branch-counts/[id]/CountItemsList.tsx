"use client";

import { useMemo, useState } from "react";
import CountItemRow from "./CountItemRow";
import { SearchIcon, XIcon, AlertIcon, CheckIcon } from "@/components/ui/icons";
import type { InventoryCountItemClientView } from "@/lib/inventory/countPresentation";

type Item = InventoryCountItemClientView;
type StatusFilter = "ALL" | "PENDING" | "COUNTED" | "NOTES" | "DIFFERENCE";

export default function CountItemsList({
  items: initialItems,
  countId,
  editable,
  isAdmin,
}: {
  items: Item[];
  countId: string;
  editable: boolean;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Actualización reactiva al guardar un renglón
  function handleItemUpdated(updatedItem: Item) {
    setItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
    );
  }

  // Métricas globales
  const totalCount = items.length;
  const countedCount = items.filter((i) => i.isCaptured).length;
  const pendingCount = totalCount - countedCount;
  const progressPercent = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;
  const notesCount = items.filter((i) => Boolean(i.notes)).length;

  const differences = useMemo(() => {
    let missingCount = 0;
    let surplusCount = 0;
    for (const item of items) {
      if (item.previousQuantity !== undefined && item.isCaptured) {
        const diff = item.quantityCounted - item.previousQuantity;
        if (diff < 0) missingCount++;
        else if (diff > 0) surplusCount++;
      }
    }
    return { missingCount, surplusCount, totalWithDiff: missingCount + surplusCount };
  }, [items]);

  // Lista de categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.productCategory) set.add(item.productCategory);
    }
    return Array.from(set).sort();
  }, [items]);

  // Filtrado
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      // Filtro de texto
      if (q) {
        const nameMatch = item.productName.toLowerCase().includes(q);
        const codeMatch = item.productCode?.toLowerCase().includes(q);
        const catMatch = item.productCategory?.toLowerCase().includes(q);
        const noteMatch = item.notes?.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !catMatch && !noteMatch) return false;
      }

      // Filtro de categoría
      if (selectedCategory !== "ALL" && item.productCategory !== selectedCategory) {
        return false;
      }

      // Filtro de estado
      if (statusFilter === "PENDING" && item.isCaptured) return false;
      if (statusFilter === "COUNTED" && !item.isCaptured) return false;
      if (statusFilter === "NOTES" && !item.notes) return false;
      if (statusFilter === "DIFFERENCE") {
        if (!item.isCaptured || item.previousQuantity === undefined) return false;
        const diff = item.quantityCounted - item.previousQuantity;
        if (diff === 0) return false;
      }

      return true;
    });
  }, [items, search, selectedCategory, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Barra de progreso y resumen de avance */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-on-surface">
              Progreso del conteo:
            </span>
            <span className="rounded-lg bg-surface-container-high px-2 py-0.5 text-xs font-bold text-primary">
              {countedCount} de {totalCount} contados ({progressPercent}%)
            </span>
          </div>

          {pendingCount > 0 && editable && (
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/20 transition active:scale-95"
            >
              <AlertIcon className="h-3.5 w-3.5" />
              <span>Ver {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}</span>
            </button>
          )}

          {pendingCount === 0 && editable && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
              <CheckIcon className="h-4 w-4" /> Todos los productos fueron contados
            </span>
          )}
        </div>

        {/* Barra visual de porcentaje */}
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className={`h-full transition-all duration-300 ${
              progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Resumen de diferencias y mermas para administradores o al revisar */}
        {(isAdmin || !editable) && (differences.totalWithDiff > 0 || notesCount > 0) && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3 text-xs">
            <span className="font-semibold text-on-surface-variant">Diferencias preliminares:</span>
            {differences.missingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-error/15 px-2 py-0.5 font-bold text-error">
                {differences.missingCount} {differences.missingCount === 1 ? "faltante" : "faltantes"}
              </span>
            )}
            {differences.surplusCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 font-bold text-primary">
                {differences.surplusCount} {differences.surplusCount === 1 ? "sobrante" : "sobrantes"}
              </span>
            )}
            {notesCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-bold text-amber-400">
                {notesCount} con justificación / merma
              </span>
            )}
            {differences.totalWithDiff > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("DIFFERENCE")}
                className="text-xs text-primary underline hover:opacity-80 ml-auto"
              >
                Filtrar discrepancias
              </button>
            )}
          </div>
        )}
      </section>

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4 space-y-3">
        {/* Buscador móvil-first */}
        <div className="relative">
          <label htmlFor="inventory-search" className="sr-only">
            Buscar producto
          </label>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            id="inventory-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, código o categoría…"
            className="w-full rounded-xl border border-outline-variant bg-background py-2.5 pl-10 pr-9 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Chips de estado */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 transition ${
              statusFilter === "ALL"
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Todos ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`rounded-lg px-3 py-1.5 transition ${
              statusFilter === "PENDING"
                ? "bg-secondary text-on-secondary"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COUNTED")}
            className={`rounded-lg px-3 py-1.5 transition ${
              statusFilter === "COUNTED"
                ? "bg-emerald-600 text-white"
                : "border border-outline-variant bg-background text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Contados ({countedCount})
          </button>
          {notesCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("NOTES")}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === "NOTES"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "border border-outline-variant bg-background text-amber-400 hover:text-amber-300"
              }`}
            >
              Con Justificación ({notesCount})
            </button>
          )}
          {(isAdmin || !editable) && differences.totalWithDiff > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("DIFFERENCE")}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === "DIFFERENCE"
                  ? "bg-error text-white font-bold"
                  : "border border-outline-variant bg-background text-error hover:opacity-80"
              }`}
            >
              Con Diferencias ({differences.totalWithDiff})
            </button>
          )}
        </div>

        {/* Chips de categorías con scroll horizontal */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="shrink-0 text-on-surface-variant text-[11px] font-semibold uppercase">
              Categoría:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`shrink-0 rounded-md px-2 py-1 transition ${
                selectedCategory === "ALL"
                  ? "bg-surface-container-highest font-bold text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-md px-2 py-1 transition ${
                  selectedCategory === cat
                    ? "bg-surface-container-highest font-bold text-on-surface"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lista de productos */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface">No se encontraron productos.</p>
            <p className="mt-1">
              Prueba cambiando los filtros o borrando el texto de búsqueda.
            </p>
            {(search || selectedCategory !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("ALL");
                  setStatusFilter("ALL");
                }}
                className="mt-3 rounded-lg border border-outline-variant bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-high"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <CountItemRow
              key={item.id}
              item={item}
              countId={countId}
              editable={editable}
              onItemUpdated={handleItemUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
}
