"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";
import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";
import { DataPanel, FilterBar, MetricCard, PageHeader, SectionHeader } from "@/components/ui/CompactUI";

interface BranchSales {
  branch: string;
  totalSales: number;
  totalDifference: number;
  count: number;
}

interface SafeBalance {
  branch: string;
  balance: number;
}

interface RecentCut {
  id: string;
  code: string;
  branch: string;
  date: string;
  totalSales: number | null;
  difference: number | null;
}

interface DashboardData {
  period: { from: string; to: string };
  totalSales: number;
  totalDifference: number;
  cortesConDiferencia: number;
  totalSafeBalance: number;
  salesByBranch: BranchSales[];
  safeBalances: SafeBalance[];
  recentCuts: RecentCut[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(value));

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadDashboard() {
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/cash-cuts/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar el dashboard");
      const result: DashboardData = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBranchSales = data
    ? Math.max(...data.salesByBranch.map((b) => b.totalSales), 1)
    : 1;

  return (
    <main className="page-frame space-y-4">
      <PageHeader title="Dashboard" description="Ventas, diferencias de caja y saldo de caja fuerte — últimos 7 días por defecto." />

      <FilterBar>
          <DateRangeCalendar from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          <button
            onClick={loadDashboard}
            className="min-h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            Filtrar
          </button>
      </FilterBar>

      {error && (
        <div className="bg-error/10 text-error text-sm rounded-md p-3 border border-error/30">
          {error}
        </div>
      )}

      {loading && <p className="text-outline text-sm">Cargando...</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Ventas totales" value={formatCurrency(data.totalSales)} />
            <MetricCard label="Diferencia acumulada" value={formatCurrency(data.totalDifference)} tone={data.totalDifference < 0 ? "danger" : "success"} />
            <MetricCard label="Cortes con diferencia" value={data.cortesConDiferencia} />
            <MetricCard label="Saldo en caja fuerte" value={formatCurrency(data.totalSafeBalance)} />
          </div>

          <DataPanel>
            <div className="space-y-3">
              <SectionHeader title="Ventas por sucursal" />
              {data.salesByBranch.length === 0 && (
                <p className="text-outline text-sm">Sin cortes cerrados en este periodo.</p>
              )}
              {data.salesByBranch.map((b) => (
                <div key={b.branch}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{b.branch}</span>
                    <span className="text-on-surface-variant">
                      {formatCurrency(b.totalSales)} · {b.count}{" "}
                      {b.count === 1 ? "corte" : "cortes"}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(b.totalSales / maxBranchSales) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>

          <Card>
            <div className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-on-surface-variant">
                Saldo por sucursal (caja fuerte)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.safeBalances.map((s) => (
                  <div key={s.branch} className="border border-outline-variant bg-surface-container-high text-on-surface rounded-md px-3 py-2">
                    <div className="text-xs text-on-surface-variant">{s.branch}</div>
                    <div className="font-semibold">{formatCurrency(s.balance)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant text-left">
                    <th className="px-4 py-3">Corte</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Ventas</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCuts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-outline">
                        Sin cortes en este periodo.
                      </td>
                    </tr>
                  )}
                  {data.recentCuts.map((c) => (
                    <tr key={c.id} className="border-outline-variant last:border-0 hover:bg-surface-container">
                      <td className="px-4 py-3 font-medium">{c.code}</td>
                      <td className="px-4 py-3">{c.branch}</td>
                      <td className="px-4 py-3">{formatDate(c.date)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.totalSales != null ? formatCurrency(c.totalSales) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          c.difference != null && Math.abs(c.difference) > 10
                            ? "text-error"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {c.difference != null ? formatCurrency(c.difference) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
