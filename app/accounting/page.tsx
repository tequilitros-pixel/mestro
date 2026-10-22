import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { getAccessibleBranchIds, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import {
  methodLabel,
  formatPaymentMoney,
  periodRange,
  shiftPeriodAnchor,
  validDateOnly,
  type AccountingPeriod,
} from "@/lib/accounting";
import { getBranchAccountingHistory } from "@/lib/accounting/branchHistory";
import { getBranchPayrollOverview } from "@/lib/accounting/payrollOverview";
import { getBranchSalesOverview } from "@/lib/accounting/branchSalesOverview";
import { getBranchInventoryOverview } from "@/lib/accounting/branchInventoryOverview";
import {
  getBranchFinancialOverview,
  getMultiBranchFinancialOverview,
  formatHumanQuantity,
} from "@/lib/accounting/financialEngine";
import { ExecutiveMultiBranchDashboard } from "@/components/accounting/ExecutiveMultiBranchDashboard";
import { BranchFinancialDashboard } from "@/components/accounting/BranchFinancialDashboard";
import { DailyBranchChart, DistributionPieChart, RankingBarChart } from "@/components/pos/SalesCharts";
import { PaymentForm, VoidPaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

type Query = {
  period?: string | string[];
  date?: string | string[];
  branch?: string | string[];
  category?: string | string[];
  status?: string | string[];
  view?: string | string[];
  page?: string | string[];
};

type AccountingView = "summary" | "payroll" | "sales" | "inventory";

const money = formatPaymentMoney;
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const control = "mt-1 w-full rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface";

function PayrollLineChart({
  title,
  description,
  branchName,
  series,
  total,
}: {
  title: string;
  description: string;
  branchName: string;
  series: Array<{ name: string; color: string; points: Array<{ key: string; label: string; value: number }> }>;
  total: number;
}) {
  const keys = [...new Set(series.flatMap((item) => item.points.map((point) => point.key)))].sort();
  const labels = new Map(series.flatMap((item) => item.points.map((point) => [point.key, point.label] as const)));
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const maximum = Math.max(...values, 0);
  const hasData = values.some((value) => value > 0);
  const width = 760;
  const height = 280;
  const left = 56;
  const right = 18;
  const top = 20;
  const bottom = 44;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xFor = (index: number) => keys.length <= 1 ? left + chartWidth / 2 : left + (index / (keys.length - 1)) * chartWidth;
  const yFor = (value: number) => top + chartHeight - (maximum > 0 ? (value / maximum) * chartHeight : 0);
  const pointFor = (point: { key: string; value: number }) => `${xFor(keys.indexOf(point.key))},${yFor(point.value)}`;
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold">{title}</h2><p className="text-sm text-on-surface-variant">{description}</p></div>
      <span className="text-xs text-on-surface-variant">Total pagado: {money(total)}</span>
    </div>
    <div className="mt-4 overflow-x-auto pb-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[42rem]" role="img" aria-label={`${title} de nómina de ${branchName}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + chartHeight - ratio * chartHeight;
          return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-outline-variant" strokeOpacity="0.45" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-on-surface-variant">{money(maximum * ratio)}</text></g>;
        })}
        <line x1={left} x2={left} y1={top} y2={top + chartHeight} stroke="currentColor" className="text-outline-variant" />
        <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} stroke="currentColor" className="text-outline-variant" />
        {keys.map((key, index) => <text key={key} x={xFor(index)} y={height - 16} textAnchor="middle" fontSize="10" fill="currentColor" className="text-on-surface-variant">{labels.get(key)}</text>)}
        {series.map((item) => <g key={item.name}>
          {item.points.length > 1 && <polyline points={item.points.map(pointFor).join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          {item.points.map((point) => <circle key={`${item.name}-${point.key}`} cx={xFor(keys.indexOf(point.key))} cy={yFor(point.value)} r="4" fill={item.color}><title>{`${item.name} · ${point.label}: ${money(point.value)}`}</title></circle>)}
        </g>)}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-on-surface-variant">{series.map((item) => <span key={item.name} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}</div>
    </div>
    {!hasData && <p className="mt-3 text-sm text-on-surface-variant">No hay datos pagados ni presupuesto publicado para mostrar en esta gráfica.</p>}
  </Card>;
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireAdmin();
  const accessibleBranchIds = await getAccessibleBranchIds();
  const query = await searchParams;
  const periodInput = single(query.period);
  const period: AccountingPeriod = periodInput === "day" || periodInput === "week" || periodInput === "month" || periodInput === "year" ? periodInput : "month";
  const dateInput = single(query.date);
  const anchor = validDateOnly(dateInput) ? dateInput : todayDateOnly();
  const { from, to } = periodRange(period, anchor);
  const requestedBranch = single(query.branch);
  const status = single(query.status) === "voided" ? "voided" : "active";
  const pageInput = Number(single(query.page));
  const currentPage = Number.isInteger(pageInput) && pageInput > 0 ? Math.min(pageInput, 10000) : 1;

  const [branches, categories] = await Promise.all([
    prisma.branch.findMany({
      where: {
        active: true,
        ...(accessibleBranchIds === null ? {} : { id: { in: accessibleBranchIds } }),
      },
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.financialMovementCategory.findMany({
      where: { direction: "EXPENSE", scope: { in: ["ACCOUNTING", "BOTH"] } },
      select: { id: true, name: true, isActive: true, requiresReason: true, requiresReceipt: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  // A branch tab is authoritative only when it belongs to the active branches
  // available to this user. This also prevents stale or inactive branch ids
  // from widening a branch-scoped page into an ambiguous view.
  const branchId = requestedBranch && branches.some((branch) => branch.id === requestedBranch) ? requestedBranch : "";
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const requestedView = single(query.view);
  const view: AccountingView = selectedBranch && (requestedView === "payroll" || requestedView === "sales" || requestedView === "inventory") ? requestedView : "summary";
  const requestedCategory = single(query.category);
  const category = categories.some((item) => item.id === requestedCategory) ? requestedCategory : "";
  const scopedBranchIds = branches.map((branch) => branch.id);
  const scope: Prisma.AccountingPaymentWhereInput = {
    branchId: branchId || { in: scopedBranchIds },
    paymentDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
    ...(category ? { categoryId: category } : {}),
  };
  const activeWhere: Prisma.AccountingPaymentWhereInput = { ...scope, voidedAt: null };
  const listWhere: Prisma.AccountingPaymentWhereInput = { ...scope, voidedAt: status === "active" ? null : { not: null } };

  const [summary, byBranch, byCategory, byDate, payments, paymentCount] = await Promise.all([
    prisma.accountingPayment.aggregate({ where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["branchId"], where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["categoryNameSnapshot"], where: activeWhere, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accountingPayment.groupBy({ by: ["paymentDate"], where: activeWhere, _sum: { amount: true } }),
    prisma.accountingPayment.findMany({
      where: listWhere,
      select: {
        id: true, paymentDate: true, branchNameSnapshot: true, categoryNameSnapshot: true, concept: true,
        payee: true, amount: true, method: true, reference: true, receiptUrl: true, notes: true,
        createdAt: true, createdBy: { select: { name: true } }, voidedAt: true,
        voidReason: true, voidedBy: { select: { name: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * 50,
      take: 50,
    }),
    prisma.accountingPayment.count({ where: listWhere }),
  ]);
  const [multiBranchOverview, branchFinancialOverview, branchHistory, payrollOverview, salesOverview, inventoryOverview] = await Promise.all([
    !selectedBranch && view === "summary"
      ? getMultiBranchFinancialOverview({ branchIds: scopedBranchIds, from, to })
      : Promise.resolve(null),
    selectedBranch && view === "summary" ? getBranchFinancialOverview({ branchId: selectedBranch.id, from, to }) : Promise.resolve(null),
    selectedBranch && view === "payroll" ? getBranchAccountingHistory({ branchId: selectedBranch.id, from, to }) : Promise.resolve(null),
    selectedBranch && view === "payroll" ? getBranchPayrollOverview({ branchId: selectedBranch.id, anchor, period }) : Promise.resolve(null),
    selectedBranch && view === "sales" ? getBranchSalesOverview({ branchId: selectedBranch.id, from, to }) : Promise.resolve(null),
    selectedBranch && view === "inventory" ? getBranchInventoryOverview({ branchId: selectedBranch.id, from, to }) : Promise.resolve(null),
  ]);

  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const branchTotals = byBranch.map((item) => ({ id: item.branchId, name: branchNames.get(item.branchId) ?? "Sucursal anterior", amount: item._sum.amount ?? new Prisma.Decimal(0), count: item._count._all })).sort((a, b) => b.amount.comparedTo(a.amount));
  const categoryTotals = byCategory.map((item) => ({ name: item.categoryNameSnapshot, amount: item._sum.amount ?? new Prisma.Decimal(0), count: item._count._all })).sort((a, b) => b.amount.comparedTo(a.amount));
  const trend = new Map<string, Prisma.Decimal>();
  for (const item of byDate) {
    const day = formatDateOnly(item.paymentDate);
    const key = period === "year" ? day.slice(0, 7) : day;
    trend.set(key, (trend.get(key) ?? new Prisma.Decimal(0)).plus(item._sum.amount ?? 0));
  }
  const queryBase = new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}), ...(status === "voided" ? { status } : {}), ...(view !== "summary" ? { view } : {}) });
  const tabHref = (nextBranchId: string) => {
    const params = new URLSearchParams(queryBase);
    params.delete("page");
    if (nextBranchId) params.set("branch", nextBranchId);
    else {
      params.delete("branch");
      params.delete("view");
    }
    return `/accounting?${params}`;
  };
  const sectionHref = (nextView: AccountingView) => {
    const params = new URLSearchParams(queryBase);
    if (nextView === "summary") params.delete("view");
    else params.set("view", nextView);
    params.delete("page");
    return `/accounting?${params}`;
  };
  const pageHref = (pageNumber: number) => {
    const params = new URLSearchParams(queryBase);
    params.set("page", String(pageNumber));
    return `/accounting?${params}`;
  };
  const periodHref = (nextAnchor: string) => {
    const params = new URLSearchParams(queryBase);
    params.set("date", nextAnchor);
    params.delete("page");
    return `/accounting?${params}`;
  };
  const previousPeriodHref = periodHref(shiftPeriodAnchor(period, anchor, -1));
  const nextPeriodHref = periodHref(shiftPeriodAnchor(period, anchor, 1));
  const todayPeriodHref = periodHref(todayDateOnly());
  const payrollPeriodHref = (nextPeriod: AccountingPeriod) => {
    const params = new URLSearchParams(queryBase);
    params.set("period", nextPeriod);
    params.set("date", anchor);
    params.delete("page");
    return `/accounting?${params}`;
  };
  const periodLabel = period === "day" ? "Día" : period === "week" ? "Semana" : period === "month" ? "Mes" : "Año";
  const payrollAnchorHref = (nextAnchor: string) => periodHref(nextAnchor);
  const periodDescription = period === "day" ? `Día ${from}` : period === "week" ? `Semana del ${from} al ${to}` : period === "month" ? new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDateOnly(`${anchor.slice(0, 7)}-01`)) : `Año ${anchor.slice(0, 4)}`;
  const workerTotals = new Map<string, { amount: number; shifts: number; byWeek: Map<string, number> }>();
  for (const row of branchHistory?.payroll ?? []) {
    for (const employee of row.employees) {
      const existing = workerTotals.get(employee.name) ?? { amount: 0, shifts: 0, byWeek: new Map<string, number>() };
      existing.amount += employee.amount;
      existing.shifts += employee.days.reduce((sum, day) => sum + day.shiftCount, 0);
      existing.byWeek.set(row.weekStart, (existing.byWeek.get(row.weekStart) ?? 0) + employee.amount);
      workerTotals.set(employee.name, existing);
    }
  }
  const workerRanking = [...workerTotals].sort(([, a], [, b]) => b.shifts - a.shifts || b.amount - a.amount);
  const workerSeries = workerRanking.slice(0, 6).map(([name, worker], index) => ({
    name,
    color: ["#38bdf8", "#a78bfa", "#f59e0b", "#34d399", "#fb7185", "#facc15"][index] ?? "#38bdf8",
    points: [...worker.byWeek].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, label: key.slice(5), value })),
  }));
  const weeklySeries = [
    { name: "Presupuestado", color: "#f59e0b", points: payrollOverview?.periodTrend.map((point) => ({ key: point.key, label: point.label, value: point.budget })) ?? [] },
    { name: "Pagado", color: "#38bdf8", points: payrollOverview?.periodTrend.map((point) => ({ key: point.key, label: point.label, value: point.paid })) ?? [] },
  ];
  const monthlySeries = [
    { name: "Presupuestado", color: "#f59e0b", points: payrollOverview?.monthTrend.map((point) => ({ key: point.key, label: point.label, value: point.budget })) ?? [] },
    { name: "Pagado", color: "#38bdf8", points: payrollOverview?.monthTrend.map((point) => ({ key: point.key, label: point.label, value: point.paid })) ?? [] },
  ];

  return <main className="page-frame mx-auto max-w-7xl space-y-6 text-on-surface">
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Control de gastos</p>
      <h1 className="text-3xl font-bold">{selectedBranch ? `Contabilidad · ${selectedBranch.name}` : "Contabilidad"}</h1>
      <p className="text-sm text-on-surface-variant">{selectedBranch ? `Resumen, pagos y entradas de ${selectedBranch.name}.` : "Pagos registrados por sucursal: cuánto se pagó, en qué y a quién."}</p>
      {user.role === "ADMIN" && <Link href="/administration/financial-categories" className="inline-block text-sm font-semibold text-primary underline">Administrar tipos de gasto</Link>}
    </header>

    <nav aria-label="Contabilidad por sucursal" className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container/60 p-2">
      <div className="flex min-w-max gap-2">
        <Link href={tabHref("")} aria-current={!branchId ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${!branchId ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>Todas</Link>
        {branches.map((branch) => {
          const active = branch.id === branchId;
          return <Link key={branch.id} href={tabHref(branch.id)} aria-current={active ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>
            {branch.name}{!branch.active && <span className="ml-1 text-xs opacity-70">(inactiva)</span>}
          </Link>;
        })}
      </div>
    </nav>
    {selectedBranch && <nav aria-label={`Secciones de ${selectedBranch.name}`} className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container/40 p-2">
      <div className="flex min-w-max gap-2">
        {([[
          "summary", "Resumen contable",
        ], [
          "payroll", "Pago en nómina",
        ], [
          "sales", "Ventas",
        ], [
          "inventory", "Inventario",
        ]] as const).map(([key, label]) => <Link key={key} href={sectionHref(key)} aria-current={view === key ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${view === key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>{label}</Link>)}
      </div>
    </nav>}

    {view === "summary" && <form method="get" className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="period" value={period} /><input type="hidden" name="date" value={anchor} />
      {selectedBranch ? <input type="hidden" name="branch" value={selectedBranch.id} /> : <label className="text-xs font-semibold text-on-surface-variant">Sucursal
        <select name="branch" defaultValue="" className={control}>
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>}
      <label className="text-xs font-semibold text-on-surface-variant">Tipo de gasto
        <select name="category" defaultValue={category} className={control}>
          <option value="">Todos los tipos</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (inactiva)"}</option>)}
        </select>
      </label>
      <div className="flex items-end"><button type="submit" className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Consultar</button></div>
    </form>}

    {view === "payroll" ? <div className="space-y-2">
      <nav aria-label="Periodo de nómina" className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container/60 p-2 text-sm">
        <span className="px-2 font-semibold text-on-surface-variant">Ver por:</span>
        {([ ["day", "Día"], ["week", "Semana"], ["month", "Mes"], ["year", "Año"] ] as const).map(([key, label]) => <Link key={key} href={payrollPeriodHref(key)} aria-current={period === key ? "page" : undefined} className={`rounded-lg px-4 py-2 font-semibold ${period === key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>{label}</Link>)}
      </nav>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container/40 p-2 text-sm">
        <Link href={payrollAnchorHref(shiftPeriodAnchor(period, anchor, -1))} aria-label={`${periodLabel} anterior`} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">← Anterior</Link>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value="payroll" /><input type="hidden" name="branch" value={branchId} /><input type="hidden" name="period" value={period} />
          <label className="font-semibold text-on-surface-variant" htmlFor="payroll-date">Ir a fecha</label>
          <input id="payroll-date" name="date" type="date" defaultValue={anchor} className="rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface" /><button type="submit" className="rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary">Ir</button>
        </form>
        <Link href={todayPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Hoy</Link>
        <Link href={payrollAnchorHref(shiftPeriodAnchor(period, anchor, 1))} aria-label={`${periodLabel} siguiente`} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Siguiente →</Link>
      </div>
    </div> : <div className="space-y-2">
      <nav aria-label="Periodo a consultar" className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container/60 p-2 text-sm">
        <span className="px-2 font-semibold text-on-surface-variant">Ver por:</span>
        {([ ["day", "Día"], ["week", "Semana"], ["month", "Mes"], ["year", "Año"] ] as const).map(([key, label]) => <Link key={key} href={payrollPeriodHref(key)} aria-current={period === key ? "page" : undefined} className={`rounded-lg px-4 py-2 font-semibold ${period === key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}`}>{label}</Link>)}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container/40 p-2 text-sm">
        <div><p className="font-semibold text-on-surface">{periodDescription}</p><p className="text-xs text-on-surface-variant">Del {from} al {to}. Los totales excluyen pagos anulados.</p></div>
        <div className="flex flex-wrap items-center gap-2"><Link href={previousPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">← Anterior</Link><form method="get" className="flex items-center gap-2"><input type="hidden" name="period" value={period} /><input type="hidden" name="view" value={view === "summary" ? "" : view} />{branchId && <input type="hidden" name="branch" value={branchId} />}{category && <input type="hidden" name="category" value={category} />}{status === "voided" && <input type="hidden" name="status" value={status} />}<label className="sr-only" htmlFor="accounting-date">Ir a fecha</label><input id="accounting-date" name="date" type="date" defaultValue={anchor} className="rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface" /><button type="submit" className="rounded-lg bg-primary px-3 py-2 font-semibold text-on-primary">Ir</button></form><Link href={todayPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Hoy</Link><Link href={nextPeriodHref} className="rounded-lg px-3 py-2 font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">Siguiente →</Link></div>
      </div>
    </div>}
    {view === "payroll" && selectedBranch && branchHistory && payrollOverview ? <section aria-label={`Pago en nómina de ${selectedBranch.name}`} className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pago en nómina</p>
        <h2 className="text-2xl font-bold">Nómina · {selectedBranch.name}</h2>
        <p className="text-sm text-on-surface-variant">Vista de {periodLabel.toLowerCase()} con el presupuesto publicado del calendario y lo que ya se ha pagado.</p>
      </div>
      {payrollOverview.estimatedPaidEntries > 0 && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-on-surface-variant">{payrollOverview.estimatedPaidEntries} pago(s) histórico(s) no incluyen importe por turno. Su total pagado se distribuye entre las sucursales según las horas registradas en el snapshot; no se modifica la nómina original.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card highlight><CardLabel>Presupuesto de la semana</CardLabel><CardValue>{money(payrollOverview.budgetWeek)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Pagado: {money(payrollOverview.week)} · turnos publicados.</p></Card>
        <Card><CardLabel>Presupuesto del mes</CardLabel><CardValue>{money(payrollOverview.budgetMonth)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Pagado: {money(payrollOverview.month)} · mes de referencia.</p></Card>
        <Card><CardLabel>Presupuesto del año</CardLabel><CardValue>{money(payrollOverview.budgetYear)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Pagado: {money(payrollOverview.year)} · año de referencia.</p></Card>
      </div>
      <PayrollLineChart title={`Evolución de nómina · ${periodLabel}`} description={`Presupuesto contra pago real agrupado por ${periodLabel.toLowerCase()} en ${selectedBranch.name}.`} branchName={selectedBranch.name} series={weeklySeries} total={payrollOverview.year} />
      <PayrollLineChart title="Comparativo mensual de nómina" description={`Meses disponibles para ${anchor.slice(0, 4)} en ${selectedBranch.name}; el filtro mensual muestra el mes consultado.`} branchName={selectedBranch.name} series={monthlySeries} total={payrollOverview.year} />
      <PayrollLineChart title="Pago por trabajador" description={`Los trabajadores con más turnos aparecen en las líneas con mayor continuidad. Filtro actual: ${periodLabel.toLowerCase()}.`} branchName={selectedBranch.name} series={workerSeries} total={payrollOverview.year} />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Quién ha trabajado más</h2><p className="text-sm text-on-surface-variant">Ranking de turnos y monto asignado dentro del periodo seleccionado.</p></div><span className="text-xs text-on-surface-variant">{workerRanking.length} trabajador(es)</span></div>
        {workerRanking.length ? <ol className="mt-4 space-y-3">{workerRanking.map(([name, worker], index) => <li key={name} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-high p-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{index + 1}</span><span className="min-w-36 flex-1 font-semibold">{name}</span><span className="text-on-surface-variant">{worker.shifts} turno(s)</span><strong>{money(worker.amount)}</strong></li>)}</ol> : <p className="mt-4 text-sm text-on-surface-variant">No hay pagos de nómina en el periodo seleccionado. El presupuesto se calcula con los turnos publicados y las tarifas vigentes.</p>}
      </Card>
    </section> : view === "sales" && selectedBranch && salesOverview ? <section aria-label={`Ventas de ${selectedBranch.name}`} className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ventas</p>
        <h2 className="text-2xl font-bold">Resumen de ventas · {selectedBranch.name}</h2>
        <p className="text-sm text-on-surface-variant">Ventas completadas entre {from} y {to}, con el mismo criterio del resumen del punto de venta.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card highlight><CardLabel>Total vendido</CardLabel><CardValue>{money(salesOverview.total)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{salesOverview.saleCount} venta(s) completada(s).</p></Card>
        <Card><CardLabel>Ticket promedio</CardLabel><CardValue>{money(salesOverview.averageTicket)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Promedio por venta del periodo.</p></Card>
        <Card><CardLabel>Unidades vendidas</CardLabel><CardValue>{salesOverview.units}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Productos de catálogo; no incluye cobros personalizados.</p></Card>
        <Card><CardLabel>Productos diferentes</CardLabel><CardValue>{salesOverview.productCount}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Productos con al menos una unidad vendida.</p></Card>
      </div>
      {salesOverview.saleCount ? <>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h3 className="font-bold">Ventas por día</h3><p className="mt-1 text-sm text-on-surface-variant">Evolución de ventas completadas en {selectedBranch.name}.</p><div className="mt-3"><DailyBranchChart data={salesOverview.daily.map((point) => ({ label: point.label, [selectedBranch.name]: point.total }))} branchNames={[selectedBranch.name]} /></div></Card>
          <Card><h3 className="font-bold">Tipos de pago</h3><p className="mt-1 text-sm text-on-surface-variant">Importe cobrado por método de pago.</p><div className="mt-3"><DistributionPieChart data={salesOverview.payments.map((payment) => ({ name: payment.label, value: payment.amount }))} /></div></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h3 className="font-bold">Productos más vendidos</h3><p className="mt-1 text-sm text-on-surface-variant">Los primeros diez productos por unidades vendidas.</p><div className="mt-3"><RankingBarChart data={salesOverview.products.slice(0, 10).map((product) => ({ name: product.name, value: product.units }))} valueLabel="Unidades" valueFormat="units" /></div></Card>
          <Card><h3 className="font-bold">Desglose por tipo de pago</h3><div className="mt-3 divide-y divide-outline-variant">{salesOverview.payments.map((payment) => <div key={payment.method} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{payment.label}</span><strong>{money(payment.amount)}</strong></div>)}</div></Card>
        </div>
        <Card><h3 className="font-bold">Productos vendidos</h3><div className="mt-3 divide-y divide-outline-variant">{salesOverview.products.map((product) => <div key={product.key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold">{product.name}</p><p className="text-xs text-on-surface-variant">{product.units} unidad(es)</p></div><strong>{money(product.total)}</strong></div>)}</div></Card>
      </> : <Card><p className="text-sm text-on-surface-variant">No hay ventas completadas en {selectedBranch.name} durante este periodo.</p></Card>}
    </section> : view === "inventory" && selectedBranch && inventoryOverview ? <section aria-label={`Inventario de ${selectedBranch.name}`} className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Inventario</p>
        <h2 className="text-2xl font-bold">Consumo de inventario · {selectedBranch.name}</h2>
        <p className="text-sm text-on-surface-variant">Comparativo entre el consumo registrado y el consumo teórico de las recetas vendidas, de {from} a {to}.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card highlight><CardLabel>Costo de consumo registrado</CardLabel><CardValue>{money(inventoryOverview.actual.cost)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{inventoryOverview.actual.products} insumo(s) · {inventoryOverview.actual.movements} movimiento(s){inventoryOverview.actual.costKnown ? "" : " · hay costos pendientes"}.</p></Card>
        <Card><CardLabel>Costo teórico por ventas</CardLabel><CardValue>{money(inventoryOverview.theoretical.cost)}</CardValue><p className="mt-1 text-xs text-on-surface-variant">{inventoryOverview.theoretical.sales} venta(s) completada(s){inventoryOverview.theoretical.costKnown ? "" : " · hay costos pendientes"}.</p></Card>
        <Card><CardLabel>Insumos consumidos</CardLabel><CardValue>{inventoryOverview.products.filter((product) => product.actualQuantity > 0).length}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Con consumo registrado por el punto de venta.</p></Card>
        <Card><CardLabel>Insumos en recetas vendidas</CardLabel><CardValue>{inventoryOverview.products.filter((product) => product.theoreticalQuantity > 0).length}</CardValue><p className="mt-1 text-xs text-on-surface-variant">Calculados con las recetas actuales de los productos vendidos.</p></Card>
      </div>
      {inventoryOverview.products.length ? <>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h3 className="font-bold">Insumos con mayor costo teórico</h3><p className="mt-1 text-sm text-on-surface-variant">Recetas de las ventas completadas del periodo.</p><div className="mt-3"><RankingBarChart data={inventoryOverview.products.filter((product) => product.theoreticalCost > 0).slice(0, 10).map((product) => ({ name: product.name, value: product.theoreticalCost }))} valueLabel="Costo teórico" /></div></Card>
          <Card><h3 className="font-bold">Cómo leer el consumo</h3><div className="mt-3 space-y-3 text-sm text-on-surface-variant"><p><strong className="text-on-surface">Registrado:</strong> salidas y devoluciones que ya están en el libro de inventario.</p><p><strong className="text-on-surface">Teórico:</strong> cantidad que debería consumirse según las recetas actuales y las ventas completadas.</p><p>Los importes convierten el costo de botella, paquete o presentación a ml, g o unidad cuando el consumo usa la unidad base. No modifican existencias.</p></div></Card>
        </div>
        <Card><h3 className="font-bold">Detalle de inventario consumido</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant"><th className="pb-2 font-medium">Insumo</th><th className="pb-2 text-right font-medium">Registrado</th><th className="pb-2 text-right font-medium">Teórico</th><th className="pb-2 text-right font-medium">Costo registrado</th><th className="pb-2 text-right font-medium">Costo teórico</th></tr></thead><tbody className="divide-y divide-outline-variant">{inventoryOverview.products.map((product) => <tr key={product.id}><td className="py-3"><p className="font-semibold">{product.name}</p><p className="text-xs text-on-surface-variant">{product.category} · {product.code}</p></td><td className="py-3 text-right">{formatHumanQuantity(product.actualQuantity, product.unit)}</td><td className="py-3 text-right">{formatHumanQuantity(product.theoreticalQuantity, product.unit)}</td><td className="py-3 text-right font-semibold">{money(product.actualCost)}{product.actualCostKnown ? "" : "*"}</td><td className="py-3 text-right font-semibold">{money(product.theoreticalCost)}{product.theoreticalCostKnown ? "" : "*"}</td></tr>)}</tbody></table></div>{(!inventoryOverview.actual.costKnown || !inventoryOverview.theoretical.costKnown) && <p className="mt-3 text-xs text-on-surface-variant">* El importe es parcial porque uno o más insumos no tienen costo unitario configurado.</p>}</Card>
      </> : <Card><p className="text-sm text-on-surface-variant">No hay consumo de inventario ni recetas vendidas en {selectedBranch.name} durante este periodo.</p></Card>}
    </section> : <>
    {view === "summary" && !selectedBranch && multiBranchOverview && (
      <ExecutiveMultiBranchDashboard
        overview={multiBranchOverview}
        period={period}
        date={anchor}
      />
    )}
    {view === "summary" && selectedBranch && branchFinancialOverview && (
      <BranchFinancialDashboard
        metrics={branchFinancialOverview}
        periodLabel={periodLabel}
        from={from}
        to={to}
      />
    )}
    <section aria-label="Resumen de pagos" className="grid gap-3 sm:grid-cols-3">
      <Card highlight><CardLabel>Total pagado</CardLabel><CardValue>{money(summary._sum.amount ?? 0)}</CardValue></Card>
      <Card><CardLabel>Pagos</CardLabel><CardValue>{summary._count._all}</CardValue></Card>
      <Card><CardLabel>Promedio por pago</CardLabel><CardValue>{money(summary._count._all ? (summary._sum.amount ?? new Prisma.Decimal(0)).div(summary._count._all) : 0)}</CardValue></Card>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 font-bold">Por sucursal</h2>{branchTotals.length ? <ul className="space-y-2">{branchTotals.map((row) => <li key={row.id} className="flex justify-between gap-3 border-b border-outline-variant pb-2 text-sm"><span>{row.name} <span className="text-on-surface-variant">({row.count})</span></span><strong>{money(row.amount)}</strong></li>)}</ul> : <p className="text-sm text-on-surface-variant">Sin pagos en este periodo.</p>}</Card>
      <Card><h2 className="mb-3 font-bold">En qué se gastó</h2>{categoryTotals.length ? <ul className="space-y-2">{categoryTotals.map((row) => <li key={row.name} className="flex justify-between gap-3 border-b border-outline-variant pb-2 text-sm"><span>{row.name} <span className="text-on-surface-variant">({row.count})</span></span><strong>{money(row.amount)}</strong></li>)}</ul> : <p className="text-sm text-on-surface-variant">Sin pagos en este periodo.</p>}</Card>
    </div>

    {trend.size > 1 && <Card><h2 className="mb-3 font-bold">Evolución {period === "year" ? "mensual" : "diaria"}</h2><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[...trend].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => <div key={key} className="rounded-lg bg-surface-container-high p-3"><p className="text-xs text-on-surface-variant">{key}</p><p className="font-semibold">{money(value)}</p></div>)}</div></Card>}

    <PaymentForm branches={branches.filter((branch) => branch.active)} categories={categories.filter((item) => item.isActive)} today={todayDateOnly()} initialRequestId={randomUUID()} initialBranchId={selectedBranch?.active ? selectedBranch.id : ""} initialBranchName={selectedBranch?.active ? selectedBranch.name : ""} collapsible={Boolean(selectedBranch)} />

    <section className="space-y-3" aria-label="Historial de pagos">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Historial</h2><p className="text-sm text-on-surface-variant">{paymentCount} {status === "voided" ? "pagos anulados" : "pagos vigentes"} en el periodo.</p></div><div className="flex gap-2 text-sm"><Link href={`/accounting?${new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}) })}`} className={status === "active" ? "font-bold text-primary" : "text-on-surface-variant underline"}>Vigentes</Link><Link href={`/accounting?${new URLSearchParams({ period, date: anchor, ...(branchId ? { branch: branchId } : {}), ...(category ? { category } : {}), status: "voided" })}`} className={status === "voided" ? "font-bold text-primary" : "text-on-surface-variant underline"}>Anulados</Link></div></div>
      {payments.length ? payments.map((payment) => <Card key={payment.id} className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{payment.concept}</p><p className="text-sm text-on-surface-variant">{payment.branchNameSnapshot} · {payment.categoryNameSnapshot} · {payment.payee}</p></div><strong>{money(payment.amount)}</strong></div>
        <p className="text-xs text-on-surface-variant">Pago: {formatDateOnly(payment.paymentDate)} · {methodLabel(payment.method)}{payment.reference ? ` · Ref. ${payment.reference}` : ""} · Registró: {payment.createdBy.name}</p>
        {payment.notes && <p className="text-xs text-on-surface-variant">{payment.notes}</p>}
        {payment.receiptUrl && <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary underline">Ver comprobante</a>}
        {payment.voidedAt ? <p className="text-xs text-error">Anulado por {payment.voidedBy?.name ?? "administrador"}: {payment.voidReason}</p> : user.role === "ADMIN" ? <VoidPaymentForm id={payment.id} /> : null}
      </Card>) : <Card><p className="text-sm text-on-surface-variant">No hay pagos {status === "voided" ? "anulados" : "vigentes"} con estos filtros.</p></Card>}
      {(currentPage > 1 || currentPage * 50 < paymentCount) && <nav aria-label="Páginas del historial" className="flex justify-between text-sm">{currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="underline">Anterior</Link> : <span />}{currentPage * 50 < paymentCount ? <Link href={pageHref(currentPage + 1)} className="underline">Siguiente</Link> : <span />}</nav>}
    </section>
    </>}
  </main>;
}
