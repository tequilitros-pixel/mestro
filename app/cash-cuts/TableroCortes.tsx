"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { PlusIcon } from "@/components/ui/icons";
import {
  EmptyState,
  FilterBar,
  MetricCard,
  PageHeader,
  StatusBadge,
} from "@/components/ui/CompactUI";

/*
 * Tablero de cortes para ADMIN, GERENTE y CONSULTA.
 * El servidor valida el alcance del rol y, para ADMIN, aplica el periodo y la
 * sucursal elegidos. El navegador nunca decide qué sucursales están
 * autorizadas.
 *
 * La busqueda, el orden y la paginacion son sobre la lista que ya
 * llego acotada por el servidor. Los indicadores se derivan de esa
 * misma lista, asi que tampoco pueden exceder el alcance del rol.
 */

type Branch = { id: string; name: string };

type Corte = {
  id: string;
  code: string;
  status: "ABIERTO" | "CERRADO" | "AUDITADO";
  date: string;
  openedAt: string;
  closedAt: string | null;
  totalSales: number | null;
  difference: number | null;
  branch: { name: string };
  responsible: { name: string };
};

type Orden = { campo: "date" | "code" | "branch" | "totalSales" | "difference"; asc: boolean };
type Periodo = "current-week" | "last-week" | "current-month" | "current-year" | "custom";

function Th({
  campo,
  children,
  className = "",
  orden,
  onSort,
}: {
  campo?: Orden["campo"];
  children: ReactNode;
  className?: string;
  orden: Orden;
  onSort: (campo: Orden["campo"]) => void;
}) {
  return (
    <th className={`sticky top-0 z-10 bg-surface-container-high px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant ${className}`}>
      {campo ? (
        <button
          type="button"
          onClick={() => onSort(campo)}
          className="inline-flex items-center gap-1 hover:text-on-surface"
        >
          {children}
          {orden.campo === campo && <span aria-hidden="true">{orden.asc ? "↑" : "↓"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

const POR_PAGINA = 25;

const money = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
    : "—";

const hora = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";

const fecha = (v: string) => new Date(v).toLocaleDateString("es-MX", { timeZone: "UTC" });

/** El esquema solo tiene ABIERTO/CERRADO/AUDITADO; el resto se deriva. */
function etiquetaEstado(c: Corte): { texto: string; tono: "neutral" | "success" | "warning" | "danger" } {
  if (c.status === "ABIERTO") return { texto: "En curso", tono: "neutral" };
  if (c.status === "AUDITADO") return { texto: "Auditado", tono: "success" };
  if (c.difference === null || c.difference === 0) return { texto: "Cerrado", tono: "success" };
  if (c.difference < 0) return { texto: "Faltante", tono: "danger" };
  return { texto: "Sobrante", tono: "warning" };
}

function colorDiferencia(d: number | null) {
  if (d === null) return "text-on-surface-variant";
  if (d === 0) return "text-tertiary-fixed-dim";
  if (d < 0) return "text-error";
  return "text-secondary";
}

export default function TableroCortes({
  branches,
  canCreate,
  canUseHistoricalFilters,
  currentWeek,
}: {
  branches: Branch[];
  canCreate: boolean;
  canUseHistoricalFilters: boolean;
  currentWeek: { startDate: string; endDate: string };
}) {
  const [status, setStatus] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("current-week");
  const [branchId, setBranchId] = useState("");
  const [desde, setDesde] = useState(currentWeek.startDate);
  const [hasta, setHasta] = useState(currentWeek.endDate);
  const [cortes, setCortes] = useState<Corte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<Orden>({ campo: "date", asc: false });
  const [pagina, setPagina] = useState(1);
  const errorRango =
    periodo === "custom" && (!desde || !hasta || desde > hasta)
      ? desde > hasta
        ? "La fecha inicial no puede ser posterior a la final."
        : "Selecciona ambas fechas."
      : null;

  useEffect(() => {
    if (errorRango) return;

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (canUseHistoricalFilters) {
      params.set("period", periodo);
      if (branchId) params.set("branchId", branchId);
      if (periodo === "custom") {
        params.set("from", desde);
        params.set("to", hasta);
      }
    }

    const controller = new AbortController();

    fetch(`/api/cash-cuts?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los cortes.");
        if (!Array.isArray(data)) throw new Error("La respuesta no es válida.");
        return data as Corte[];
      })
      .then(setCortes)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setCortes([]);
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar los cortes.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });

    return () => controller.abort();
  }, [branchId, canUseHistoricalFilters, desde, errorRango, hasta, periodo, status]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? cortes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.responsible.name.toLowerCase().includes(q),
        )
      : cortes;

    const dir = orden.asc ? 1 : -1;
    return [...base].sort((a, b) => {
      switch (orden.campo) {
        case "code":
          return a.code.localeCompare(b.code) * dir;
        case "branch":
          return a.branch.name.localeCompare(b.branch.name) * dir;
        case "totalSales":
          return ((a.totalSales ?? 0) - (b.totalSales ?? 0)) * dir;
        case "difference":
          return ((a.difference ?? 0) - (b.difference ?? 0)) * dir;
        default:
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      }
    });
  }, [cortes, busqueda, orden]);

  const indicadores = useMemo(() => {
    const abiertos = filtrados.filter((c) => c.status === "ABIERTO").length;
    const cerrados = filtrados.filter((c) => c.status !== "ABIERTO").length;
    const venta = filtrados.reduce((s, c) => s + (c.totalSales ?? 0), 0);
    const conDiferencia = filtrados.filter(
      (c) => c.status !== "ABIERTO" && c.difference !== null && c.difference !== 0,
    );
    const porRevisar = conDiferencia.filter((c) => c.status !== "AUDITADO").length;
    return { abiertos, cerrados, venta, diferencias: conDiferencia.length, porRevisar };
  }, [filtrados]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const iniciarRecarga = () => {
    setCargando(true);
    setError(null);
    setPagina(1);
  };

  const limpiar = () => {
    if (status || branchId || periodo !== "current-week") {
      iniciarRecarga();
    } else {
      setPagina(1);
    }
    setStatus("");
    setBusqueda("");
    setPeriodo("current-week");
    setBranchId("");
    setDesde(currentWeek.startDate);
    setHasta(currentWeek.endDate);
  };

  const hayFiltros = Boolean(
    status || busqueda || branchId || periodo !== "current-week",
  );

  const nombreSucursal = branchId
    ? branches.find((branch) => branch.id === branchId)?.name ?? "Sucursal seleccionada"
    : canUseHistoricalFilters
      ? "Todas las sucursales"
      : branches[0]?.name ?? "sin definir";

  const nombrePeriodo: Record<Periodo, string> = {
    "current-week": `Esta semana (${currentWeek.startDate} al ${currentWeek.endDate})`,
    "last-week": "Semana pasada",
    "current-month": "Este mes",
    "current-year": "Todo el año",
    custom: `${desde} al ${hasta}`,
  };

  const ordenarPor = (campo: Orden["campo"]) => {
    setPagina(1);
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: false }));
  };

  const errorVisible = errorRango ?? error;
  const cargandoVisible = cargando && !errorRango;

  return (
    <main className="page-frame max-w-7xl space-y-4">
      <PageHeader
        title="Cortes de caja"
        description={`${nombreSucursal} · ${nombrePeriodo[periodo]}. Los cortes abiertos pendientes siempre se muestran.`}
        actions={
          canCreate ? (
            <Link
              href="/cash-cuts/daily/new"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-bold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo corte
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <MetricCard label="Cortes abiertos" value={String(indicadores.abiertos)} />
        <MetricCard label="Cerrados del periodo" value={String(indicadores.cerrados)} />
        <MetricCard label="Venta total" value={money(indicadores.venta)} />
        <MetricCard label="Diferencias detectadas" value={String(indicadores.diferencias)} />
        <MetricCard label="Pendientes de revisión" value={String(indicadores.porRevisar)} />
      </div>

      <FilterBar className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
            Corte o responsable
          </label>
          <input
            id="q"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Ej. CC-TLALTENANGO o nombre"
            className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
          />
        </div>

        {canUseHistoricalFilters && (
          <>
            <div>
              <label htmlFor="periodo" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Periodo
              </label>
              <select
                id="periodo"
                value={periodo}
                onChange={(e) => {
                  iniciarRecarga();
                  setPeriodo(e.target.value as Periodo);
                }}
                className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
              >
                <option value="current-week">Esta semana</option>
                <option value="last-week">Semana pasada</option>
                <option value="current-month">Este mes</option>
                <option value="current-year">Todo el año</option>
                <option value="custom">Fechas personalizadas</option>
              </select>
            </div>

            <div>
              <label htmlFor="sucursal" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Sucursal
              </label>
              <select
                id="sucursal"
                value={branchId}
                onChange={(e) => {
                  iniciarRecarga();
                  setBranchId(e.target.value);
                }}
                className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label htmlFor="est" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
            Estado
          </label>
          <select
            id="est"
            value={status}
            onChange={(e) => {
              iniciarRecarga();
              setStatus(e.target.value);
            }}
            className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="ABIERTO">En curso</option>
            <option value="CERRADO">Cerrado</option>
            <option value="AUDITADO">Auditado</option>
          </select>
        </div>

        {canUseHistoricalFilters && periodo === "custom" && (
          <>
            <div>
              <label htmlFor="desde" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Desde
              </label>
              <input
                id="desde"
                type="date"
                value={desde}
                max={hasta}
                onChange={(e) => {
                  iniciarRecarga();
                  setDesde(e.target.value);
                }}
                className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="hasta" className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                Hasta
              </label>
              <input
                id="hasta"
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => {
                  iniciarRecarga();
                  setHasta(e.target.value);
                }}
                className="compact-field w-full border border-outline-variant bg-surface-container-high text-on-surface outline-none transition focus:border-primary"
              />
            </div>
          </>
        )}

        {hayFiltros && (
          <div className="flex items-end sm:col-span-2 lg:col-span-6">
            <button type="button" onClick={limpiar}
              className="min-h-11 rounded-lg border border-outline-variant px-3 text-[13px] font-semibold text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface">
              Limpiar filtros
            </button>
          </div>
        )}
      </FilterBar>

      {cargandoVisible && <p className="text-sm text-on-surface-variant">Cargando…</p>}
      {errorVisible && <p className="text-sm text-error">{errorVisible}</p>}

      {!cargandoVisible && !errorVisible && filtrados.length === 0 && (
        <EmptyState>
          {!branches.length
            ? "No hay una sucursal de trabajo definida. Inicia un corte o pide que te asignen una única sucursal."
            : hayFiltros
            ? "No hay cortes que coincidan con esos filtros."
            : "Todavía no hay cortes registrados."}
        </EmptyState>
      )}

      {!cargandoVisible && !errorVisible && filtrados.length > 0 && (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-outline-variant md:block">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <Th campo="date" orden={orden} onSort={ordenarPor}>Fecha</Th>
                  <Th campo="code" orden={orden} onSort={ordenarPor}>Código</Th>
                  <Th campo="branch" orden={orden} onSort={ordenarPor}>Sucursal</Th>
                  <Th orden={orden} onSort={ordenarPor}>Responsable</Th>
                  <Th orden={orden} onSort={ordenarPor}>Apertura</Th>
                  <Th orden={orden} onSort={ordenarPor}>Cierre</Th>
                  <Th campo="totalSales" orden={orden} onSort={ordenarPor} className="text-right">Venta</Th>
                  <Th campo="difference" orden={orden} onSort={ordenarPor} className="text-right">Diferencia</Th>
                  <Th orden={orden} onSort={ordenarPor}>Estado</Th>
                  <Th orden={orden} onSort={ordenarPor}>Acción</Th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c, i) => {
                  const e = etiquetaEstado(c);
                  return (
                    <tr key={c.id} className={`border-t border-outline-variant ${i % 2 ? "bg-surface-container-low/40" : ""} hover:bg-surface-container`}>
                      <td className="px-3 py-2 text-on-surface">{fecha(c.date)}</td>
                      <td className="px-3 py-2 font-mono text-on-surface-variant">{c.code}</td>
                      <td className="px-3 py-2 font-semibold text-on-surface">{c.branch.name}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{c.responsible.name}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{hora(c.openedAt)}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{hora(c.closedAt)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-on-surface">{money(c.totalSales)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${colorDiferencia(c.difference)}`}>
                        {c.difference === null ? "—" : `${c.difference > 0 ? "+" : ""}${money(c.difference)}`}
                      </td>
                      <td className="px-3 py-2"><StatusBadge tone={e.tono}>{e.texto}</StatusBadge></td>
                      <td className="px-3 py-2">
                        <Link href={`/cash-cuts/daily/${c.id}`} className="font-semibold text-on-surface underline-offset-2 hover:underline">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular */}
          <div className="space-y-2 md:hidden">
            {visibles.map((c) => {
              const e = etiquetaEstado(c);
              return (
                <div key={c.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-on-surface">{fecha(c.date)}</span>
                    <StatusBadge tone={e.tono}>{e.texto}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{c.branch.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.responsible.name} · <span className="font-mono">{c.code}</span>
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-on-surface-variant">Venta</p>
                      <p className="text-base font-bold text-on-surface">{money(c.totalSales)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-on-surface-variant">Diferencia</p>
                      <p className={`text-base font-bold ${colorDiferencia(c.difference)}`}>
                        {c.difference === null ? "—" : `${c.difference > 0 ? "+" : ""}${money(c.difference)}`}
                      </p>
                    </div>
                  </div>
                  <Link href={`/cash-cuts/daily/${c.id}`}
                    className="mt-4 flex min-h-11 items-center justify-center rounded-lg border border-outline-variant text-sm font-semibold text-on-surface transition hover:bg-surface-container">
                    Ver detalle
                  </Link>
                </div>
              );
            })}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">
                {filtrados.length} cortes · página {pagina} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}
                  className="min-h-11 rounded-lg border border-outline-variant px-3 text-[13px] font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-40">
                  Anterior
                </button>
                <button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((p) => p + 1)}
                  className="min-h-11 rounded-lg border border-outline-variant px-3 text-[13px] font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
