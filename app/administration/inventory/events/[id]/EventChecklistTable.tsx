"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ChecklistItemRow, { type EventChecklistItem } from "./ChecklistItemRow";
import EventPhaseConfirm from "./EventPhaseConfirm";

type Item = EventChecklistItem & { category: string; productCode?: string | null };

const TODOS = "__todos__";

export default function EventChecklistTable({
  eventId,
  phase,
  items,
  confirmed,
}: {
  eventId: string;
  phase: "salida" | "regreso";
  items: Item[];
  confirmed: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendientes" | "revisados" | "diferencias">("todos");
  const [categoria, setCategoria] = useState<string>(TODOS);
  const isReturn = phase === "regreso";

  // La categoria elegida sobrevive a recargas y a ir y volver de pestaña.
  const storageKey = `maestro:evento:${eventId}:${phase}:categoria`;
  useEffect(() => {
    const guardada = sessionStorage.getItem(storageKey);
    if (guardada) setCategoria(guardada);
  }, [storageKey]);
  useEffect(() => {
    sessionStorage.setItem(storageKey, categoria);
  }, [storageKey, categoria]);

  /** Coincide con el buscador y el filtro de estado (sin mirar categoria). */
  const coincide = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es-MX");
    return (item: Item) => {
      const reviewed = isReturn ? item.checkedIn : item.checkedOut;
      const reference = isReturn ? (item.sentQuantity ?? item.plannedQuantity) : item.plannedQuantity;
      const actual = isReturn ? (item.returnedQuantity ?? 0) : (item.sentQuantity ?? item.plannedQuantity);
      const difference = Math.abs(reference - actual - (isReturn ? item.damagedQuantity : 0)) > 0.001;

      const pasaFiltro =
        filter === "todos" ||
        (filter === "pendientes" && !reviewed) ||
        (filter === "revisados" && reviewed) ||
        (filter === "diferencias" && reviewed && difference);

      if (!pasaFiltro) return false;
      if (!q) return true;

      // Busca por nombre y tambien por codigo.
      return (
        item.productName.toLocaleLowerCase("es-MX").includes(q) ||
        (item.productCode ?? "").toLocaleLowerCase("es-MX").includes(q)
      );
    };
  }, [filter, isReturn, query]);

  /* Categorias del catalogo real: se derivan de los productos del evento,
   * no de una lista fija. El contador refleja el buscador y el filtro
   * activos, para que la pestaña diga lo que de verdad vas a ver. */
  const categorias = useMemo(() => {
    const totales = new Map<string, number>();
    for (const item of items) {
      const c = item.category || "Sin categoría";
      if (!totales.has(c)) totales.set(c, 0);
      if (coincide(item)) totales.set(c, (totales.get(c) ?? 0) + 1);
    }
    return [...totales.entries()].sort((a, b) => a[0].localeCompare(b[0], "es-MX"));
  }, [items, coincide]);

  const totalVisible = useMemo(() => items.filter(coincide).length, [items, coincide]);

  const esVisible = (item: Item) =>
    coincide(item) && (categoria === TODOS || (item.category || "Sin categoría") === categoria);

  const visibles = items.filter(esVisible).length;
  const reviewedCount = items.filter((item) => (isReturn ? item.checkedIn : item.checkedOut)).length;
  const progress = items.length === 0 ? 0 : Math.round((reviewedCount / items.length) * 100);
  const heading = isReturn ? "Lista de regreso" : "Lista para llevar";

  return (
    <section className="space-y-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-on-surface">{heading}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {reviewedCount} de {items.length} renglones revisados
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="compact-action border border-outline-variant bg-transparent text-on-surface hover:bg-surface-container-high"
        >
          Guardar avance
        </button>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container p-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-high">
          <div className="bg-tertiary-fixed-dim transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">Avance: {progress}%</p>
      </div>

      {/* Pestañas de categoría. El scroll horizontal vive aquí, no en la página. */}
      {items.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
          <div
            role="tablist"
            aria-label="Categorías de producto"
            className="flex min-w-max items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container p-1.5"
          >
            <button
              role="tab"
              type="button"
              aria-selected={categoria === TODOS}
              onClick={() => setCategoria(TODOS)}
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition duration-150 ${
                categoria === TODOS
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`}
            >
              Todos
              <span className={`rounded-full px-1.5 text-xs font-bold ${categoria === TODOS ? "bg-on-primary/20" : "bg-surface-container-highest"}`}>
                {totalVisible}
              </span>
            </button>

            {categorias.map(([nombre, cuenta]) => {
              const activa = categoria === nombre;
              return (
                <button
                  key={nombre}
                  role="tab"
                  type="button"
                  aria-selected={activa}
                  disabled={cuenta === 0 && !activa}
                  onClick={() => setCategoria(nombre)}
                  className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition duration-150 disabled:opacity-35 ${
                    activa
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  {nombre}
                  <span className={`rounded-full px-1.5 text-xs font-bold ${activa ? "bg-on-primary/20" : "bg-surface-container-highest"}`}>
                    {cuenta}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container p-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o código"
          className="h-11 min-w-48 flex-1 rounded-md border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-on-surface"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          className="h-11 rounded-md border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-on-surface"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendientes">Pendientes</option>
          <option value="revisados">Revisados</option>
          <option value="diferencias">Con diferencia</option>
        </select>
        <span className="px-2 text-xs text-on-surface-variant">
          {visibles} resultado{visibles === 1 ? "" : "s"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">
          {isReturn ? "Nada que regresar todavía." : "Este evento no tiene productos ni equipo asignado."}
        </div>
      ) : (
        <>
          {visibles === 0 && (
            <div className="rounded-xl border border-dashed border-outline-variant p-8 text-center text-sm text-on-surface-variant">
              No hay productos que coincidan con los filtros.
            </div>
          )}

          {/*
           * IMPORTANTE: se renderizan TODAS las filas siempre y se ocultan
           * las que no aplican, en vez de desmontarlas. ChecklistItemRow
           * guarda las cantidades tecleadas en estado local; si se
           * desmontara al cambiar de categoría o de filtro, se perderia
           * lo que el usuario acaba de capturar y no ha guardado.
           */}
          <div className={`overflow-hidden rounded-xl border border-outline-variant bg-surface-container ${visibles === 0 ? "hidden" : ""}`}>
            <div className="hidden grid-cols-[2.5rem_minmax(13rem,1.8fr)_minmax(9rem,1fr)_7rem_12rem_8rem_7rem_6.5rem_2rem] gap-2 border-b border-outline-variant px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant md:grid">
              <span>Verif.</span><span>Producto</span><span>Presentación</span><span>{isReturn ? "Salió" : "Planeado"}</span><span>{isReturn ? "Regresan cerradas" : "Cargado"}</span><span>{isReturn ? "Remanente" : "Diferencia"}</span><span>{isReturn ? "Consumo" : "Estado"}</span><span>{isReturn ? "Estado" : ""}</span><span>Acc.</span>
            </div>
            {items.map((item) => (
              <div key={item.id} hidden={!esVisible(item)}>
                <ChecklistItemRow item={item} eventId={eventId} phase={phase} locked={confirmed} />
              </div>
            ))}
          </div>
        </>
      )}

      <EventPhaseConfirm eventId={eventId} phase={phase} disabled={reviewedCount !== items.length || confirmed} />
    </section>
  );
}
