"use client";

import { useEffect, useState, startTransition, type FormEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatCivilDate } from "@/lib/dateTime";

type HistoryCut = {
  id: string;
  code: string;
  status: "CERRADO" | "AUDITADO";
  date: string;
  totalSales: number | null;
  archivedAt: string | null;
  branch: { id: string; name: string };
  responsible: { id: string; name: string };
};

type HistoryResponse = {
  items: HistoryCut[];
  total: number;
  page: number;
  pageSize: number;
  branches: { id: string; name: string }[];
};

type Filters = { from: string; to: string; branchId: string; employee: string };
const emptyFilters: Filters = { from: "", to: "", branchId: "", employee: "" };
const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function CashCutsHistoryPage() {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ view: "history", page: String(page) });
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.employee) params.set("employee", filters.employee);
    startTransition(() => { setLoading(true); setError(null); });
    fetch(`/api/cash-cuts?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial.");
        return body as HistoryResponse;
      })
      .then((body) => { setData(body); setLoading(false); })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("La fecha inicial debe ser anterior a la fecha final.");
      return;
    }
    setPage(1);
    setFilters({ ...draft });
  }

  return (
    <main className="page-frame max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Cortes de caja</h1>
        <p className="text-sm text-on-surface-variant">Historial de cortes archivados y de semanas anteriores.</p>
      </div>
      <nav aria-label="Vistas de cortes" className="flex gap-2 border-b border-outline-variant pb-2 text-sm font-bold">
        <Link href="/cash-cuts" className="rounded-lg px-4 py-2 text-on-surface-variant hover:bg-surface-container">Cortes actuales</Link>
        <span aria-current="page" className="rounded-lg bg-primary px-4 py-2 text-on-primary">Historial</span>
      </nav>

      <form onSubmit={search} className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-semibold text-on-surface-variant">Desde
          <input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className="compact-field mt-1 w-full" />
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">Hasta
          <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className="compact-field mt-1 w-full" />
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">Sucursal
          <select value={draft.branchId} onChange={(event) => setDraft({ ...draft, branchId: event.target.value })} className="compact-field mt-1 w-full">
            <option value="">Todas</option>
            {data?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-on-surface-variant">Empleado
          <input type="search" value={draft.employee} maxLength={100} onChange={(event) => setDraft({ ...draft, employee: event.target.value })} placeholder="Nombre del responsable" className="compact-field mt-1 w-full" />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary">Buscar</button>
          <button type="button" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold text-on-surface-variant">Limpiar</button>
        </div>
      </form>

      {loading && <p className="text-sm text-on-surface-variant">Cargando...</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {!loading && !error && data && <>
        <p className="text-xs text-on-surface-variant">{data.total} {data.total === 1 ? "corte" : "cortes"} encontrados</p>
        {data.items.length === 0 ? <Card><p className="text-sm text-on-surface-variant">No hay cortes con estos filtros.</p></Card> : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full min-w-[740px] text-sm">
              <thead className="bg-surface-container-high text-left text-xs text-on-surface-variant"><tr>
                <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Sucursal</th><th className="px-3 py-2">Empleado</th><th className="px-3 py-2">Código</th><th className="px-3 py-2 text-right">Venta</th><th className="px-3 py-2">Registro</th><th className="px-3 py-2">Detalle</th>
              </tr></thead>
              <tbody>{data.items.map((cut) => <tr key={cut.id} className="border-t border-outline-variant">
                <td className="px-3 py-2">{formatCivilDate(cut.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                <td className="px-3 py-2">{cut.branch.name}</td>
                <td className="px-3 py-2">{cut.responsible.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{cut.code}</td>
                <td className="px-3 py-2 text-right">{money(cut.totalSales)}</td>
                <td className="px-3 py-2">{cut.archivedAt ? "Archivado" : "Semana anterior"}</td>
                <td className="px-3 py-2"><Link href={`/cash-cuts/daily/${cut.id}`} className="font-bold text-primary hover:underline">Ver</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        {data.total > data.pageSize && <div className="flex items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 1} className="rounded-lg border border-outline-variant px-4 py-2 disabled:opacity-40">Anterior</button>
          <span>Página {page} de {Math.ceil(data.total / data.pageSize)}</span>
          <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page * data.pageSize >= data.total} className="rounded-lg border border-outline-variant px-4 py-2 disabled:opacity-40">Siguiente</button>
        </div>}
      </>}
    </main>
  );
}
