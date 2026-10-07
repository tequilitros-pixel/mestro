"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import {
  ReceiptIcon,
  XIcon,
  HomeIcon,
  StoreIcon,
  BottleIcon,
  GridIcon,
  WalletIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";
import { DateRangeCalendar } from "@/components/ui/DateRangeCalendar";
import {
  DailyBranchChart,
  RankingBarChart,
  DistributionPieChart,
  HourlyChart,
} from "./SalesCharts";
import {
  todayDateOnly,
  formatBusinessDateOnly,
} from "@/lib/dateOnly";
import { formatBusinessDate, formatBusinessTime } from "@/lib/dateTime";
import { aggregateProductSales } from "@/lib/pos/salesAnalytics";
import {
  salesPeriodDateRange,
  shiftSalesPeriodRange,
  type SalesPeriod,
} from "@/lib/pos/salesPeriod";

type SaleItem = { id: string; name: string; quantity: number; lineTotal: number };
type SalePayment = { method: string; amount: number };

type Sale = {
  id: string;
  code: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  branch: { id: string; name: string };
  soldBy: { id: string; name: string };
  cashCut: { id: string; code: string } | null;
  items: SaleItem[];
  payments: SalePayment[];
};

type AnalyticsSale = {
  id: string;
  code: string;
  total: number;
  createdAt: string;
  branch: { id: string; name: string };
  soldBy: { id: string; name: string };
  payments: SalePayment[];
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
    isCustom: boolean;
    productId: string | null;
    productName: string | null;
    categoryName: string | null;
  }>;
};

type BranchOption = { id: string; name: string };

const PERIOD_LABELS: Record<SalesPeriod, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  custom: "Calendario",
};

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  DIDI: "DiDi",
  UBER: "Uber",
  RAPPI: "Rappi",
  VALES: "Vales",
  OTRO: "Otro",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const formatTime = (iso: string) =>
  formatBusinessTime(iso);

const formatDayLabel = (iso: string) =>
  formatBusinessDate(`${iso}T12:00:00.000Z`, {
    day: "2-digit",
    month: "short",
  });

function dayKey(iso: string) {
  return formatBusinessDateOnly(new Date(iso));
}

function EmptyPeriod() {
  return (
    <Card className="text-center">
      <p className="text-sm text-on-surface-variant">
        No hay ventas registradas en este periodo para este filtro.
      </p>
    </Card>
  );
}

export default function SalesDashboardClient({
  branches,
  initialSales,
  analytics: initialAnalytics,
  canCancel,
}: {
  branches: BranchOption[];
  initialSales: Sale[];
  analytics: AnalyticsSale[];
  canCancel: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState(todayDateOnly());
  const [dateTo, setDateTo] = useState(todayDateOnly());
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [analyticsBranchId, setAnalyticsBranchId] = useState("");
  const [period, setPeriod] = useState<SalesPeriod>("day");
  const [analyticsFrom, setAnalyticsFrom] = useState(todayDateOnly());
  const [analyticsTo, setAnalyticsTo] = useState(todayDateOnly());
  const [analytics, setAnalytics] = useState<AnalyticsSale[]>(initialAnalytics);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  async function refetch(nextBranchId: string, nextFrom: string, nextTo: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextBranchId) params.set("branchId", nextBranchId);
    params.set("dateFrom", nextFrom);
    params.set("dateTo", nextTo);

    const res = await fetch(`/api/pos/sales?${params.toString()}`);
    if (res.ok) {
      setSales(await res.json());
    }
    setLoading(false);
  }

  function handleBranchChange(value: string) {
    setBranchId(value);
    refetch(value, dateFrom, dateTo);
  }

  async function loadAnalytics(from: string, to: string) {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    const params = new URLSearchParams();
    params.set("dateFrom", from);
    params.set("dateTo", to);

    try {
      const res = await fetch(`/api/pos/sales/analytics?${params.toString()}`);
      if (!res.ok) throw new Error("No fue posible cargar el periodo.");
      setAnalytics(await res.json());
    } catch {
      setAnalyticsError("No fue posible cargar las ventas. Intenta de nuevo.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function handlePeriodChange(nextPeriod: Exclude<SalesPeriod, "custom">) {
    const range = salesPeriodDateRange(nextPeriod);
    setPeriod(nextPeriod);
    setAnalyticsFrom(range.from);
    setAnalyticsTo(range.to);
    void loadAnalytics(range.from, range.to);
  }

  function handlePeriodStep(direction: -1 | 1) {
    const range = shiftSalesPeriodRange(
      period,
      { from: analyticsFrom, to: analyticsTo },
      direction,
    );
    setAnalyticsFrom(range.from);
    setAnalyticsTo(range.to);
    void loadAnalytics(range.from, range.to);
  }

  function handleAnalyticsRange(nextFrom: string, nextTo: string) {
    setPeriod("custom");
    setAnalyticsFrom(nextFrom);
    setAnalyticsTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) void loadAnalytics(nextFrom, nextTo);
  }

  async function handleCancel(sale: Sale) {
    const reason = prompt(`Cancelar venta ${sale.code}. Motivo (opcional):`);
    if (reason === null) return;

    setCancellingId(sale.id);
    const res = await fetch(`/api/pos/sales/${sale.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setCancellingId(null);

    if (!res.ok) {
      alert(data.error ?? "No fue posible cancelar la venta.");
      return;
    }

    refetch(branchId, dateFrom, dateTo);
  }

  const activeSales = sales.filter((s) => s.status !== "CANCELADA");

  const summary = useMemo(() => {
    const totalSales = activeSales.reduce((sum, s) => sum + s.total, 0);
    const byMethod = new Map<string, number>();
    for (const sale of activeSales) {
      for (const payment of sale.payments) {
        byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amount);
      }
    }
    return {
      totalSales,
      count: activeSales.length,
      byMethod,
      ticket: activeSales.length > 0 ? totalSales / activeSales.length : 0,
    };
  }, [activeSales]);

  /** Ventas del periodo filtradas por la sucursal elegida en las pestañas visuales. */
  const scopedAnalytics = useMemo(
    () =>
      analyticsBranchId
        ? analytics.filter((s) => s.branch.id === analyticsBranchId)
        : analytics,
    [analytics, analyticsBranchId],
  );

  const periodTotals = useMemo(() => {
    const total = scopedAnalytics.reduce((sum, s) => sum + s.total, 0);
    const days = new Set(scopedAnalytics.map((s) => dayKey(s.createdAt)));
    return {
      total,
      count: scopedAnalytics.length,
      ticket: scopedAnalytics.length > 0 ? total / scopedAnalytics.length : 0,
      dailyAverage: days.size > 0 ? total / days.size : 0,
      activeDays: days.size,
    };
  }, [scopedAnalytics]);

  const branchSalesSummary = useMemo(() => {
    const totals = new Map(
      branches.map((branch) => [
        branch.id,
        { id: branch.id, name: branch.name, total: 0 },
      ]),
    );

    for (const sale of scopedAnalytics) {
      const current = totals.get(sale.branch.id) ?? {
        id: sale.branch.id,
        name: sale.branch.name,
        total: 0,
      };
      current.total += sale.total;
      totals.set(sale.branch.id, current);
    }

    return Array.from(totals.values())
      .filter((branch) => !analyticsBranchId || branch.id === analyticsBranchId)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  }, [analyticsBranchId, branches, scopedAnalytics]);

  const highestBranchTotal = Math.max(0, ...branchSalesSummary.map((branch) => branch.total));

  /** Serie diaria: una columna por sucursal para comparar. */
  const dailyByBranch = useMemo(() => {
    const branchNames = Array.from(
      new Set(analytics.map((s) => s.branch.name)),
    ).sort((a, b) => a.localeCompare(b, "es"));

    const byDay = new Map<string, Record<string, number>>();

    for (const sale of analytics) {
      const key = dayKey(sale.createdAt);
      const row = byDay.get(key) ?? {};
      row[sale.branch.name] = (row[sale.branch.name] ?? 0) + sale.total;
      byDay.set(key, row);
    }

    const data = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, row]) => {
        const point: Record<string, string | number> = {
          day,
          label: formatDayLabel(day),
        };
        for (const name of branchNames) {
          point[name] = Math.round(row[name] ?? 0);
        }
        return point;
      });

    return { data, branchNames };
  }, [analytics]);

  const branchRanking = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const sale of analytics) {
      const current = totals.get(sale.branch.name) ?? { total: 0, count: 0 };
      current.total += sale.total;
      current.count += 1;
      totals.set(sale.branch.name, current);
    }
    return Array.from(totals.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [analytics]);

  const productRanking = useMemo(() => {
    return aggregateProductSales(scopedAnalytics);
  }, [scopedAnalytics]);

  const productTotals = useMemo(
    () => ({
      units: productRanking.reduce((sum, product) => sum + product.units, 0),
      products: productRanking.length,
      total: productRanking.reduce((sum, product) => sum + product.total, 0),
    }),
    [productRanking],
  );

  const categoryRanking = useMemo(() => {
    const totals = new Map<string, { total: number; units: number }>();
    for (const sale of scopedAnalytics) {
      for (const item of sale.items) {
        const name = item.categoryName ?? "Cobros personalizados";
        const current = totals.get(name) ?? { total: 0, units: 0 };
        current.total += item.lineTotal;
        current.units += item.quantity;
        totals.set(name, current);
      }
    }
    return Array.from(totals.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [scopedAnalytics]);

  const paymentBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of scopedAnalytics) {
      for (const payment of sale.payments) {
        const label = PAYMENT_LABELS[payment.method] ?? payment.method;
        totals.set(label, (totals.get(label) ?? 0) + payment.amount);
      }
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [scopedAnalytics]);

  const hourlyData = useMemo(() => {
    const totals = new Array(24).fill(0) as number[];
    for (const sale of scopedAnalytics) {
      totals[Number(formatBusinessTime(sale.createdAt).slice(0, 2))] += sale.total;
    }
    return totals
      .map((total, hour) => ({ label: `${String(hour).padStart(2, "0")}h`, total, hour }))
      .filter((point) => point.total > 0);
  }, [scopedAnalytics]);

  const customCharges = useMemo(
    () =>
      scopedAnalytics.flatMap((sale) =>
        sale.items
          .filter((item) => item.isCustom)
          .map((item, index) => ({
            id: `${sale.id}-${index}`,
            saleId: sale.id,
            code: sale.code,
            createdAt: sale.createdAt,
            branch: sale.branch,
            soldBy: sale.soldBy,
            description: item.name,
            quantity: item.quantity,
            amount: item.lineTotal,
          })),
      ),
    [scopedAnalytics],
  );

  const customChargeSummary = useMemo(() => {
    const total = customCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const days = new Set(customCharges.map((charge) => dayKey(charge.createdAt)));
    return {
      total,
      count: customCharges.length,
      days: days.size,
      average: customCharges.length ? total / customCharges.length : 0,
    };
  }, [customCharges]);

  const customByEmployee = useMemo(() => {
    const totals = new Map<string, number>();
    for (const charge of customCharges) {
      totals.set(charge.soldBy.name, (totals.get(charge.soldBy.name) ?? 0) + charge.amount);
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [customCharges]);

  const customByBranch = useMemo(() => {
    const totals = new Map<string, number>();
    for (const charge of customCharges) {
      totals.set(charge.branch.name, (totals.get(charge.branch.name) ?? 0) + charge.amount);
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [customCharges]);

  const customByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const charge of customCharges) {
      const key = dayKey(charge.createdAt);
      totals.set(key, (totals.get(key) ?? 0) + charge.amount);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({ name: formatDayLabel(day), value: Math.round(value) }));
  }, [customCharges]);

  /** Filtro de la lista: aplica el buscador sobre las ventas del día. */
  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;

    return sales.filter((sale) => {
      const haystack = [
        sale.code,
        sale.branch.name,
        sale.soldBy.name,
        sale.cashCut?.code ?? "",
        ...sale.items.map((i) => i.name),
        ...sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [sales, search]);

  const analyticsScopeLabel =
    branches.find((b) => b.id === analyticsBranchId)?.name ?? "Todas las sucursales";

  const periodFrom = analyticsFrom;
  const periodTo = analyticsTo;

  const periodRangeLabel =
    period === "day"
      ? periodFrom === todayDateOnly()
        ? "Hoy"
        : formatDayLabel(periodFrom)
      : period === "week"
        ? `Del ${formatDayLabel(periodFrom)} al ${formatDayLabel(periodTo)} (lun-dom)`
        : period === "month"
          ? `Del ${formatDayLabel(periodFrom)} al ${formatDayLabel(periodTo)}`
          : `Del ${formatDayLabel(periodFrom)} al ${formatDayLabel(periodTo)}`;

  const analyticsScopeSelector = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container p-1">
        {(["day", "week", "month"] as Array<Exclude<SalesPeriod, "custom">>).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePeriodChange(p)}
            disabled={analyticsLoading}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
              period === p
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container p-1">
        <button
          type="button"
          onClick={() => handlePeriodStep(-1)}
          disabled={analyticsLoading}
          aria-label={`${PERIOD_LABELS[period]} anterior`}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => handlePeriodStep(1)}
          disabled={analyticsLoading}
          aria-label={`${PERIOD_LABELS[period]} siguiente`}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60"
        >
          Siguiente
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <DateRangeCalendar
        compact
        from={analyticsFrom}
        to={analyticsTo}
        onFromChange={(value) => handleAnalyticsRange(value, analyticsTo)}
        onToChange={(value) => handleAnalyticsRange(analyticsFrom, value)}
      />

      <select
        value={analyticsBranchId}
        onChange={(e) => setAnalyticsBranchId(e.target.value)}
        className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
      >
        <option value="">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <p className="text-xs text-on-surface-variant">
        {analyticsLoading ? "Cargando..." : periodRangeLabel} · {analyticsScopeLabel}
      </p>
      {analyticsError && (
        <p role="alert" className="w-full text-sm font-medium text-error">
          {analyticsError}
        </p>
      )}
    </div>
  );

  const emptyPeriod = scopedAnalytics.length === 0;

  const emptyPeriodCard = <EmptyPeriod />;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-5">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Ventas del Punto de Venta</h1>
        <p className="text-sm text-on-surface-variant">
          Resumen visual del periodo y consulta detallada por día.
        </p>
      </div>

      <PageTabs
        tabs={[
          {
            key: "resumen",
            label: "Resumen",
            icon: <HomeIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Card className="p-4">
                    <CardLabel>Ventas del periodo</CardLabel>
                    <CardValue>{formatCurrency(periodTotals.total)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {periodTotals.count} venta{periodTotals.count === 1 ? "" : "s"}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <CardLabel>Promedio diario</CardLabel>
                    <CardValue>{formatCurrency(periodTotals.dailyAverage)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {periodTotals.activeDays} días con venta
                    </p>
                  </Card>

                  <Card className="p-4">
                    <CardLabel>Ticket promedio</CardLabel>
                    <CardValue>{formatCurrency(periodTotals.ticket)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">Por venta</p>
                  </Card>

                  <Card className="p-4">
                    <CardLabel>Hoy</CardLabel>
                    <CardValue>{formatCurrency(summary.totalSales)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.count} venta{summary.count === 1 ? "" : "s"}
                    </p>
                  </Card>
                </div>

                <Card>
                  <CardLabel>Total vendido por sucursal</CardLabel>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Ventas completadas del periodo seleccionado.
                  </p>
                  <div className="mt-4 space-y-4">
                    {branchSalesSummary.map((branch) => (
                      <div key={branch.id}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-on-surface">
                            {branch.name}
                          </span>
                          <strong className="shrink-0 tabular-nums text-on-surface">
                            {formatCurrency(branch.total)}
                          </strong>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: highestBranchTotal > 0
                                ? `${(branch.total / highestBranchTotal) * 100}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {branchSalesSummary.length === 0 && (
                      <p className="text-sm text-on-surface-variant">
                        No hay sucursales disponibles para mostrar.
                      </p>
                    )}
                  </div>
                </Card>

                {emptyPeriod ? (
                  emptyPeriodCard
                ) : (
                  <>
                    <Card>
                      <CardLabel>Ventas diarias por sucursal</CardLabel>
                      <DailyBranchChart
                        data={dailyByBranch.data}
                        branchNames={dailyByBranch.branchNames}
                      />
                    </Card>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardLabel>Productos más vendidos</CardLabel>
                        <RankingBarChart
                          data={productRanking.slice(0, 5).map((p) => ({
                            name: p.name,
                            value: p.units,
                          }))}
                          valueLabel="Unidades"
                          valueFormat="units"
                        />
                      </Card>

                      <Card>
                        <CardLabel>Métodos de pago</CardLabel>
                        <DistributionPieChart data={paymentBreakdown} />
                      </Card>
                    </div>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "sucursales",
            label: "Sucursales",
            icon: <StoreIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                {analytics.length === 0 ? (
                  emptyPeriodCard
                ) : (
                  <>
                    <Card>
                      <CardLabel>Comparativa diaria por sucursal</CardLabel>
                      <DailyBranchChart
                        data={dailyByBranch.data}
                        branchNames={dailyByBranch.branchNames}
                      />
                    </Card>

                    <Card>
                      <CardLabel>Total del periodo por sucursal</CardLabel>
                      <RankingBarChart
                        data={branchRanking.map((b) => ({
                          name: b.name,
                          value: Math.round(b.total),
                        }))}
                      />
                    </Card>

                    <Card>
                      <CardLabel>Detalle por sucursal</CardLabel>
                      <div className="mt-2 divide-y divide-outline-variant">
                        {branchRanking.map((branch) => {
                          const share =
                            periodTotals.total > 0
                              ? Math.round((branch.total / periodTotals.total) * 100)
                              : 0;

                          return (
                            <div
                              key={branch.name}
                              className="flex items-center justify-between gap-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-on-surface">
                                  {branch.name}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  {branch.count} ventas · ticket{" "}
                                  {formatCurrency(branch.total / branch.count)}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="font-bold text-on-surface">
                                  {formatCurrency(branch.total)}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  {share}% del total
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "productos",
            label: "Productos",
            icon: <BottleIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                {emptyPeriod ? (
                  emptyPeriodCard
                ) : productRanking.length === 0 ? (
                  <Card className="text-center">
                    <p className="text-sm text-on-surface-variant">
                      No hay productos de catálogo vendidos en este periodo. Los cobros
                      personalizados no se cuentan como productos.
                    </p>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Card className="p-4">
                        <CardLabel>Unidades vendidas</CardLabel>
                        <CardValue>{productTotals.units}</CardValue>
                      </Card>
                      <Card className="p-4">
                        <CardLabel>Productos diferentes</CardLabel>
                        <CardValue>{productTotals.products}</CardValue>
                      </Card>
                      <Card className="p-4">
                        <CardLabel>Importe de productos</CardLabel>
                        <CardValue>{formatCurrency(productTotals.total)}</CardValue>
                      </Card>
                    </div>

                    <Card>
                      <CardLabel>Top 10 productos por unidades</CardLabel>
                      <RankingBarChart
                        data={productRanking.slice(0, 10).map((p) => ({
                          name: p.name,
                          value: p.units,
                        }))}
                        valueLabel="Unidades"
                        valueFormat="units"
                      />
                    </Card>

                    <Card>
                      <CardLabel>Todos los productos</CardLabel>
                      <div className="mt-2 divide-y divide-outline-variant">
                        {productRanking.map((product) => (
                          <div
                            key={product.key}
                            className="flex items-center justify-between gap-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-on-surface">
                                {product.name}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {product.units} unidades
                              </p>
                            </div>

                            <p className="shrink-0 font-bold text-on-surface">
                              {formatCurrency(product.total)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "categorias",
            label: "Categorías",
            icon: <GridIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                {emptyPeriod ? (
                  emptyPeriodCard
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardLabel>Participación por categoría</CardLabel>
                        <DistributionPieChart
                          data={categoryRanking.map((c) => ({
                            name: c.name,
                            value: Math.round(c.total),
                          }))}
                        />
                      </Card>

                      <Card>
                        <CardLabel>Venta por categoría</CardLabel>
                        <RankingBarChart
                          data={categoryRanking.map((c) => ({
                            name: c.name,
                            value: Math.round(c.total),
                          }))}
                        />
                      </Card>
                    </div>

                    <Card>
                      <CardLabel>Detalle por categoría</CardLabel>
                      <div className="mt-2 divide-y divide-outline-variant">
                        {categoryRanking.map((category) => {
                          const share =
                            periodTotals.total > 0
                              ? Math.round((category.total / periodTotals.total) * 100)
                              : 0;

                          return (
                            <div
                              key={category.name}
                              className="flex items-center justify-between gap-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-on-surface">
                                  {category.name}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  {category.units} unidades · {share}% del total
                                </p>
                              </div>

                              <p className="shrink-0 font-bold text-on-surface">
                                {formatCurrency(category.total)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "personalizados",
            label: "Cobros personalizados",
            icon: <ReceiptIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                {customCharges.length === 0 ? (
                  <Card className="text-center">
                    <p className="text-sm text-on-surface-variant">
                      No hay cobros personalizados en el periodo y sucursal seleccionados.
                    </p>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Card className="p-4">
                        <CardLabel>Total personalizado</CardLabel>
                        <CardValue>{formatCurrency(customChargeSummary.total)}</CardValue>
                      </Card>
                      <Card className="p-4">
                        <CardLabel>Cobros</CardLabel>
                        <CardValue>{customChargeSummary.count}</CardValue>
                      </Card>
                      <Card className="p-4">
                        <CardLabel>Promedio</CardLabel>
                        <CardValue>{formatCurrency(customChargeSummary.average)}</CardValue>
                      </Card>
                      <Card className="p-4">
                        <CardLabel>Días con cobro</CardLabel>
                        <CardValue>{customChargeSummary.days}</CardValue>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardLabel>Total por empleado</CardLabel>
                        <RankingBarChart
                          data={customByEmployee}
                          valueLabel="Cobros personalizados"
                        />
                      </Card>
                      <Card>
                        <CardLabel>Total por sucursal</CardLabel>
                        <RankingBarChart
                          data={customByBranch}
                          valueLabel="Cobros personalizados"
                        />
                      </Card>
                    </div>

                    <Card>
                      <CardLabel>Total por día</CardLabel>
                      <RankingBarChart
                        data={customByDay}
                        valueLabel="Cobros personalizados"
                      />
                    </Card>

                    <Card>
                      <CardLabel>Detalle para localizar cada cobro</CardLabel>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                            <tr>
                              <th className="px-3 py-3">Fecha y hora</th>
                              <th className="px-3 py-3">Folio</th>
                              <th className="px-3 py-3">Descripción</th>
                              <th className="px-3 py-3">Empleado</th>
                              <th className="px-3 py-3">Sucursal</th>
                              <th className="px-3 py-3 text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customCharges.map((charge) => (
                              <tr key={charge.id} className="border-b border-outline-variant last:border-0">
                                <td className="px-3 py-3 text-on-surface-variant">
                                  {formatDayLabel(dayKey(charge.createdAt))} · {formatTime(charge.createdAt)}
                                </td>
                                <td className="px-3 py-3 font-semibold text-on-surface">{charge.code}</td>
                                <td className="max-w-[280px] truncate px-3 py-3 text-on-surface">{charge.description}</td>
                                <td className="px-3 py-3 text-on-surface-variant">{charge.soldBy.name}</td>
                                <td className="px-3 py-3 text-on-surface-variant">{charge.branch.name}</td>
                                <td className="px-3 py-3 text-right font-bold text-on-surface">{formatCurrency(charge.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "pagos",
            label: "Pagos y horarios",
            icon: <WalletIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {analyticsScopeSelector}

                {emptyPeriod ? (
                  emptyPeriodCard
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <CardLabel>Métodos de pago del periodo</CardLabel>
                        <DistributionPieChart data={paymentBreakdown} />
                      </Card>

                      <Card>
                        <CardLabel>Desglose</CardLabel>
                        <div className="mt-2 divide-y divide-outline-variant">
                          {paymentBreakdown.map((method) => {
                            const share =
                              periodTotals.total > 0
                                ? Math.round((method.value / periodTotals.total) * 100)
                                : 0;

                            return (
                              <div
                                key={method.name}
                                className="flex items-center justify-between gap-4 py-3"
                              >
                                <span className="text-on-surface-variant">
                                  {method.name}
                                </span>
                                <span className="text-right">
                                  <span className="block font-bold text-on-surface">
                                    {formatCurrency(method.value)}
                                  </span>
                                  <span className="text-xs text-on-surface-variant">
                                    {share}%
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <CardLabel>Ventas por hora del día</CardLabel>
                      <HourlyChart data={hourlyData} />
                    </Card>
                  </>
                )}
              </div>
            ),
          },

          {
            key: "buscar",
            label: "Buscar",
            icon: <SearchIcon className="h-4 w-4" />,
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por folio, producto, sucursal, vendedor o corte..."
                    className="min-w-[240px] flex-1 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary"
                  />

                  <select
                    value={branchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <DateRangeCalendar
                    compact
                    from={dateFrom}
                    to={dateTo}
                    onFromChange={(value) => {
                      setDateFrom(value);
                      if (value && dateTo && value <= dateTo) void refetch(branchId, value, dateTo);
                    }}
                    onToChange={(value) => {
                      setDateTo(value);
                      if (dateFrom && value && dateFrom <= value) void refetch(branchId, dateFrom, value);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card>
                    <CardLabel>Ventas del rango</CardLabel>
                    <CardValue>{formatCurrency(summary.totalSales)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {summary.count} venta{summary.count === 1 ? "" : "s"}
                    </p>
                  </Card>

                  <Card>
                    <CardLabel>Ticket promedio</CardLabel>
                    <CardValue>{formatCurrency(summary.ticket)}</CardValue>
                    <p className="mt-1 text-xs text-on-surface-variant">Del rango filtrado</p>
                  </Card>

                  <Card>
                    <CardLabel>Por método de pago</CardLabel>
                    {summary.byMethod.size === 0 ? (
                      <p className="text-sm text-on-surface-variant">Sin ventas</p>
                    ) : (
                      <div className="space-y-0.5">
                        {Array.from(summary.byMethod.entries()).map(([method, amount]) => (
                          <div key={method} className="flex justify-between text-sm">
                            <span className="text-on-surface-variant">
                              {PAYMENT_LABELS[method] ?? method}
                            </span>
                            <span className="font-semibold text-on-surface">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <div className="space-y-2">
                  {loading && (
                    <p className="text-center text-sm text-on-surface-variant">
                      Cargando...
                    </p>
                  )}

                  {!loading && filteredSales.length === 0 && (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        {search
                          ? "Ninguna venta coincide con la búsqueda."
                          : "No hay ventas para este filtro."}
                      </p>
                    </Card>
                  )}

                  {!loading &&
                    filteredSales.map((sale) => (
                      <Card
                        key={sale.id}
                        className={sale.status === "CANCELADA" ? "opacity-60" : ""}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/pos/sales/${sale.id}`}
                                className="font-semibold text-on-surface hover:underline"
                              >
                                {sale.code}
                              </Link>
                              {sale.status === "CANCELADA" && (
                                <span className="rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">
                                  Cancelada
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-on-surface-variant">
                              {sale.branch.name} · {formatTime(sale.createdAt)} ·{" "}
                              {sale.soldBy.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-on-surface-variant">
                              {sale.items
                                .map((i) => `${i.quantity}× ${i.name}`)
                                .join(", ")}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-on-surface">
                              {formatCurrency(sale.total)}
                            </p>
                            <p className="text-xs text-on-surface-variant">
                              {sale.payments
                                .map((p) => PAYMENT_LABELS[p.method] ?? p.method)
                                .join(" + ")}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
                          {sale.cashCut ? (
                            <Link
                              href={`/cash-cuts/daily/${sale.cashCut.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <ReceiptIcon className="h-3.5 w-3.5" />
                              Corte {sale.cashCut.code}
                            </Link>
                          ) : (
                            <span />
                          )}

                          {canCancel && sale.status !== "CANCELADA" && (
                            <button
                              disabled={cancellingId === sale.id}
                              onClick={() => handleCancel(sale)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-error hover:underline disabled:opacity-40"
                            >
                              <XIcon className="h-3.5 w-3.5" />
                              {cancellingId === sale.id ? "Cancelando..." : "Cancelar"}
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
