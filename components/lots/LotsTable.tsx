"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, ChevronRightIcon, SearchIcon, XIcon } from "@/components/ui/icons";
import { EmptyState, FilterBar, StatusBadge } from "@/components/ui/CompactUI";
import { addDaysToDateOnly, firstDayOfMonth, lastDayOfMonth, todayDateOnly } from "@/lib/dateOnly";

export type LotListItem = { id: string; code: string; stage: string; agaveKg: number; art: number | null; startedAt: string };
export type LotFilters = { query: string; status: "ALL" | "ACTIVE" | "TERMINATED"; sort: "desc" | "asc"; year: string; month: string; from: string; to: string };

const STAGE_LABELS: Record<string, string> = { RECEPCION: "Recepción", COCCION: "Cocción", MOLIENDA: "Molienda", FERMENTACION: "Fermentación", DESTILACION: "Destilación", RECTIFICACION: "Rectificación", TERMINADO: "Terminado" };
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function lotStatus(stage: string) { return stage === "TERMINADO" ? "Terminado" : "En proceso"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(value)); }
function compactDate(value: string) { return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }

export default function LotsTable({ lots, filters }: { lots: LotListItem[]; filters: LotFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.query);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(filters.year);
  const [draftMonth, setDraftMonth] = useState(filters.month);
  const [draftFrom, setDraftFrom] = useState(filters.from);
  const [draftTo, setDraftTo] = useState(filters.to);

  const activeDateLabel = useMemo(() => {
    if (filters.from || filters.to) return filters.from && filters.to ? `${compactDate(filters.from)} – ${compactDate(filters.to)}` : filters.from ? `Desde ${compactDate(filters.from)}` : `Hasta ${compactDate(filters.to)}`;
    if (filters.year && filters.month) return `${MONTHS[Number(filters.month) - 1]} ${filters.year}`;
    return filters.year || "";
  }, [filters]);
  const activeCount = Number(Boolean(filters.query)) + Number(filters.status !== "ALL") + Number(Boolean(activeDateLabel)) + Number(filters.sort !== "desc");
  const years = Array.from({ length: 12 }, (_, index) => String(Number(todayDateOnly().slice(0, 4)) - index));

  function navigate(changes: Partial<LotFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    const next = { ...filters, ...changes };
    (Object.entries(next) as Array<[keyof LotFilters, string]>).forEach(([key, value]) => {
      if (!value || (key === "status" && value === "ALL") || (key === "sort" && value === "desc")) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
  }

  function applyDate() {
    navigate(draftFrom || draftTo ? { from: draftFrom, to: draftTo, year: "", month: "" } : { year: draftYear, month: draftMonth, from: "", to: "" });
    setDateOpen(false);
  }

  function setQuickDate(kind: "month" | "previousMonth" | "year" | "previousYear") {
    const today = todayDateOnly();
    const currentYear = today.slice(0, 4);
    if (kind === "month") { setDraftFrom(firstDayOfMonth(today)); setDraftTo(lastDayOfMonth(today)); }
    if (kind === "previousMonth") { const previous = addDaysToDateOnly(firstDayOfMonth(today), -1); setDraftFrom(firstDayOfMonth(previous)); setDraftTo(lastDayOfMonth(previous)); }
    if (kind === "year") { setDraftFrom(`${currentYear}-01-01`); setDraftTo(`${currentYear}-12-31`); }
    if (kind === "previousYear") { const year = String(Number(currentYear) - 1); setDraftFrom(`${year}-01-01`); setDraftTo(`${year}-12-31`); }
  }

  const clearDate = () => { setDraftYear(""); setDraftMonth(""); setDraftFrom(""); setDraftTo(""); navigate({ year: "", month: "", from: "", to: "" }); };

  return <div className="space-y-3">
    <FilterBar className="flex-nowrap overflow-x-auto py-3">
      <form className="relative min-w-[13rem] shrink-0" onSubmit={(event) => { event.preventDefault(); navigate({ query }); }}>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="h-9 w-full rounded-lg border border-outline-variant bg-background pl-9 pr-3 text-[13px] text-on-surface outline-none focus:border-primary" />
      </form>
      <select value={filters.status} onChange={(event) => navigate({ status: event.target.value as LotFilters["status"] })} className="h-9 shrink-0 rounded-lg border border-outline-variant bg-background px-3 pr-8 text-[13px] text-on-surface outline-none focus:border-primary"><option value="ALL">Estado</option><option value="ACTIVE">En proceso</option><option value="TERMINATED">Terminado</option></select>
      <div className="relative shrink-0">
        <button type="button" onClick={() => setDateOpen((open) => !open)} aria-expanded={dateOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-background px-3 text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-container-high"><CalendarIcon className="h-4 w-4 text-on-surface-variant" />Fecha</button>
        {dateOpen && <div className="absolute left-0 top-11 z-30 w-[22rem] rounded-xl border border-outline-variant bg-surface-container p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-2"><select value={draftYear} onChange={(event) => setDraftYear(event.target.value)} className="h-9 rounded-lg border border-outline-variant bg-background px-2 text-[13px] text-on-surface"><option value="">Año</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><select value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="h-9 rounded-lg border border-outline-variant bg-background px-2 text-[13px] text-on-surface"><option value="">Mes</option>{MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] text-on-surface-variant">Desde<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-background px-2 text-[13px] text-on-surface" /></label><label className="text-[11px] text-on-surface-variant">Hasta<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-outline-variant bg-background px-2 text-[13px] text-on-surface" /></label></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]"><button type="button" onClick={() => setQuickDate("month")} className="h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high">Este mes</button><button type="button" onClick={() => setQuickDate("previousMonth")} className="h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high">Mes anterior</button><button type="button" onClick={() => setQuickDate("year")} className="h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high">Este año</button><button type="button" onClick={() => setQuickDate("previousYear")} className="h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high">Año anterior</button></div>
          <div className="mt-3 flex items-center justify-between"><button type="button" onClick={clearDate} className="h-8 px-2 text-[12px] font-medium text-on-surface-variant hover:text-on-surface">Limpiar fecha</button><button type="button" onClick={applyDate} className="h-8 rounded-lg bg-primary px-3 text-[12px] font-semibold text-on-primary">Aplicar</button></div>
        </div>}
      </div>
      <select value={filters.sort} onChange={(event) => navigate({ sort: event.target.value as LotFilters["sort"] })} className="h-9 shrink-0 rounded-lg border border-outline-variant bg-background px-3 pr-8 text-[13px] text-on-surface outline-none focus:border-primary"><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select>
      <p className="ml-auto shrink-0 text-[13px] text-on-surface-variant">{lots.length} {lots.length === 1 ? "resultado" : "resultados"}</p>
      {activeCount > 0 && <button type="button" onClick={() => { setQuery(""); setDraftYear(""); setDraftMonth(""); setDraftFrom(""); setDraftTo(""); navigate({ query: "", status: "ALL", sort: "desc", year: "", month: "", from: "", to: "" }); }} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"><XIcon className="h-4 w-4" />Limpiar</button>}
    </FilterBar>
    {activeDateLabel && <div className="flex items-center gap-2"><button type="button" onClick={clearDate} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-container-high px-2 text-[11px] font-medium text-on-surface-variant hover:text-on-surface">{activeDateLabel}<XIcon className="h-3 w-3" /></button></div>}
    {lots.length === 0 ? <EmptyState>No hay lotes que coincidan con los filtros.</EmptyState> : <>
      <div className="hidden overflow-hidden rounded-xl border border-outline-variant md:block"><table className="w-full table-fixed border-collapse text-left"><colgroup><col className="w-[19%]" /><col className="w-[14%]" /><col className="w-[10%]" /><col className="w-[16%]" /><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[6%]" /></colgroup><thead className="bg-surface-container-high text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"><tr className="h-10 align-middle"><th className="px-4 text-left">Código de lote</th><th className="px-3 text-left">Agave</th><th className="px-3 text-left">ART</th><th className="px-3 text-left">Inicio</th><th className="px-3 text-left">Etapa actual</th><th className="px-3 text-left">Estado</th><th className="px-3 text-center"><span className="sr-only">Abrir</span></th></tr></thead><tbody>{lots.map((lot) => <LotRow key={lot.id} lot={lot} />)}</tbody></table></div>
      <div className="space-y-2 md:hidden">{lots.map((lot) => <Link key={lot.id} href={`/lots/${lot.id}`} className="block rounded-xl border border-outline-variant bg-surface-container p-3 transition-colors hover:bg-surface-container-high"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-on-surface">{lot.code}</p><p className="mt-1 text-xs text-on-surface-variant">{formatDate(lot.startedAt)} · {STAGE_LABELS[lot.stage] ?? lot.stage}</p></div><StatusBadge tone={lot.stage === "TERMINADO" ? "success" : "neutral"}>{lotStatus(lot.stage)}</StatusBadge></div><p className="mt-2 text-sm text-on-surface">{lot.agaveKg.toLocaleString("es-MX")} kg de agave <span className="text-on-surface-variant">· ART {lot.art ?? "—"}</span></p></Link>)}</div>
    </>}
  </div>;
}

function LotRow({ lot }: { lot: LotListItem }) {
  const router = useRouter();
  const open = () => router.push(`/lots/${lot.id}`);
  return <tr tabIndex={0} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }} className="h-14 cursor-pointer align-middle border-t border-outline-variant text-sm transition-colors duration-150 hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><td className="truncate px-4 align-middle font-mono font-semibold text-on-surface">{lot.code}</td><td className="truncate px-3 align-middle text-on-surface">{lot.agaveKg.toLocaleString("es-MX")} kg</td><td className="px-3 align-middle text-on-surface">{lot.art ?? "—"}</td><td className="truncate px-3 align-middle text-on-surface-variant">{formatDate(lot.startedAt)}</td><td className="truncate px-3 align-middle text-on-surface">{STAGE_LABELS[lot.stage] ?? lot.stage}</td><td className="px-3 align-middle"><StatusBadge tone={lot.stage === "TERMINADO" ? "success" : "neutral"}>{lotStatus(lot.stage)}</StatusBadge></td><td className="px-3 text-center align-middle"><Link href={`/lots/${lot.id}`} onClick={(event) => event.stopPropagation()} aria-label={`Abrir lote ${lot.code}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"><ChevronRightIcon className="h-4 w-4" /></Link></td></tr>;
}
