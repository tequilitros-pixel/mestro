"use client";

import { useEffect, useState, startTransition } from "react";
import { Card } from "@/components/ui/Card";

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Ventas, diferencias de caja y saldo de caja fuerte — últimos 7 días por defecto.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Desde</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Hasta</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={loadDashboard}
            className="bg-yellow-400 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm"
          >
            Filtrar
          </button>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md p-3 border border-red-200">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Cargando...</p>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-500">Ventas totales</div>
                <div className="text-2xl font-bold text-navy-900">
                  {formatCurrency(data.totalSales)}
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-500">Diferencia acumulada</div>
                <div
                  className={`text-2xl font-bold ${
                    data.totalDifference < 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {formatCurrency(data.totalDifference)}
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-500">Cortes con diferencia</div>
                <div className="text-2xl font-bold text-navy-900">
                  {data.cortesConDiferencia}
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-500">Saldo en caja fuerte</div>
                <div className="text-2xl font-bold text-navy-900">
                  {formatCurrency(data.totalSafeBalance)}
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Ventas por sucursal</h2>
              {data.salesByBranch.length === 0 && (
                <p className="text-gray-400 text-sm">Sin cortes cerrados en este periodo.</p>
              )}
              {data.salesByBranch.map((b) => (
                <div key={b.branch}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{b.branch}</span>
                    <span className="text-gray-500">
                      {formatCurrency(b.totalSales)} · {b.count}{" "}
                      {b.count === 1 ? "corte" : "cortes"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-navy-900 h-2 rounded-full"
                      style={{ width: `${(b.totalSales / maxBranchSales) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-600">
                Saldo por sucursal (caja fuerte)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.safeBalances.map((s) => (
                  <div key={s.branch} className="border rounded-md px-3 py-2">
                    <div className="text-xs text-gray-500">{s.branch}</div>
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
                  <tr className="bg-navy-900 text-white text-left">
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
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        Sin cortes en este periodo.
                      </td>
                    </tr>
                  )}
                  {data.recentCuts.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.code}</td>
                      <td className="px-4 py-3">{c.branch}</td>
                      <td className="px-4 py-3">{formatDate(c.date)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.totalSales != null ? formatCurrency(c.totalSales) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          c.difference != null && Math.abs(c.difference) > 10
                            ? "text-red-600"
                            : "text-gray-500"
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
    </div>
  );
}
