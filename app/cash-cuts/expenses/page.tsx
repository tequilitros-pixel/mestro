"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { ExpensesCharts } from "@/components/cash-cuts/ExpensesCharts";
import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";

interface Branch { id: string; name: string; }
interface Outflow {
  id: string;
  concept: string;
  category: string;
  amount: number;
  occurredAt: string;
  cashCut: { code: string; branch: { name: string } };
}
type Preset = "current-week" | "previous-week" | "current-month" | "previous-month" | "custom";
type Tab = "summary" | "charts";

const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const dateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function periodFor(preset: Exclude<Preset, "custom">) {
  const today = new Date();
  const currentMonday = new Date(today);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (preset === "current-week") {
    const end = new Date(currentMonday); end.setDate(end.getDate() + 6);
    return { from: dateInput(currentMonday), to: dateInput(end) };
  }
  if (preset === "previous-week") {
    const start = new Date(currentMonday); start.setDate(start.getDate() - 7);
    const end = new Date(currentMonday); end.setDate(end.getDate() - 1);
    return { from: dateInput(start), to: dateInput(end) };
  }
  const year = today.getFullYear();
  const month = today.getMonth();
  const selectedMonth = preset === "current-month" ? month : month - 1;
  return {
    from: dateInput(new Date(year, selectedMonth, 1)),
    to: dateInput(new Date(year, selectedMonth + 1, 0)),
  };
}

export default function ExpensesPage() {
  const initialPeriod = periodFor("current-week");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [concept, setConcept] = useState("");
  const [preset, setPreset] = useState<Preset>("current-week");
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [outflows, setOutflows] = useState<Outflow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");

  useEffect(() => {
    fetch("/api/branches").then((res) => res.ok ? res.json() : []).then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const load = async () => {
        setLoading(true);
        const params = new URLSearchParams({ from, to });
        if (branchId) params.set("branchId", branchId);
        if (concept.trim()) params.set("concept", concept.trim());
        try {
          const res = await fetch(`/api/salidas?${params}`, { signal: controller.signal });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "No se pudieron consultar las salidas.");
          setOutflows(data);
          setError(null);
        } catch (cause) {
          if ((cause as Error).name !== "AbortError") setError(cause instanceof Error ? cause.message : "No se pudieron consultar las salidas.");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      };
      void load();
    }, concept ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [branchId, concept, from, to]);

  const analytics = useMemo(() => {
    const categories = new Map<string, number>();
    const days = new Map<string, { label: string; amount: number }>();
    let total = 0;
    for (const outflow of outflows) {
      total += outflow.amount;
      categories.set(outflow.category, (categories.get(outflow.category) ?? 0) + outflow.amount);
      const key = outflow.occurredAt.slice(0, 10);
      const current = days.get(key) ?? { label: new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(`${key}T12:00:00`)), amount: 0 };
      current.amount += outflow.amount;
      days.set(key, current);
    }
    const byCategory = [...categories].map(([name, value]) => ({ name, value })).toSorted((a, b) => b.value - a.value);
    return { total, average: outflows.length ? total / outflows.length : 0, byCategory, byDay: [...days.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([, value]) => value) };
  }, [outflows]);

  function selectPreset(nextPreset: Preset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const next = periodFor(nextPreset);
      setFrom(next.from); setTo(next.to);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Salidas de caja</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Consulta egresos por periodo, sucursal y concepto.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo de consulta">
          {([
            ["current-week", "Esta semana"], ["previous-week", "Semana anterior"], ["current-month", "Este mes"], ["previous-month", "Mes anterior"], ["custom", "Personalizado"],
          ] as Array<[Preset, string]>).map(([key, label]) => (
            <button key={key} type="button" onClick={() => selectPreset(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${preset === key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"}`}>{label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DateRangeCalendar from={from} to={to} onFromChange={(value) => { setFrom(value); setPreset("custom"); }} onToChange={(value) => { setTo(value); setPreset("custom"); }} />
          <label className="text-xs font-semibold text-on-surface-variant">Sucursal<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-on-surface-variant">Concepto<input value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. hielo, taxi..." className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary" /></label>
        </div>
      </Card>

      <div className="flex gap-2 border-b border-outline-variant" role="tablist" aria-label="Vista de salidas">
        {([ ["summary", "Resumen"], ["charts", "Gráficas"] ] as Array<[Tab, string]>).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}>{label}</button>)}
      </div>

      {error && <Card className="border-error/30 bg-error/10 text-sm text-error">{error}</Card>}
      {loading && <p className="text-sm text-on-surface-variant">Actualizando salidas...</p>}

      {tab === "summary" ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card highlight><CardLabel>Total de salidas</CardLabel><CardValue>{money(analytics.total)}</CardValue></Card>
          <Card><CardLabel>Movimientos</CardLabel><CardValue>{outflows.length}</CardValue></Card>
          <Card><CardLabel>Promedio por salida</CardLabel><CardValue>{money(analytics.average)}</CardValue></Card>
        </div>
        {analytics.byCategory.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{analytics.byCategory.map(({ name, value }) => <Card key={name}><CardLabel>{name}</CardLabel><p className="text-lg font-bold text-on-surface">{money(value)}</p></Card>)}</div>}
        {!loading && outflows.length === 0 ? <Card><p className="text-sm text-on-surface-variant">No hay salidas en el periodo y filtros seleccionados.</p></Card> : <div className="space-y-2">{outflows.map((outflow) => <Card key={outflow.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-on-surface">{outflow.concept}</p><p className="mt-1 text-xs text-on-surface-variant">{outflow.category} · {outflow.cashCut.branch.name} · {outflow.cashCut.code}</p><p className="mt-1 text-xs text-outline">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(outflow.occurredAt))}</p></div><p className="font-bold text-on-surface">{money(outflow.amount)}</p></div></Card>)}</div>}
      </> : <Card><ExpensesCharts byCategory={analytics.byCategory} byDay={analytics.byDay} /></Card>}
    </div>
  );
}
