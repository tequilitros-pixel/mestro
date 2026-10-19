import Link from "next/link";
import type { ReactNode } from "react";
import { InventoryMovementTypeV2, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/auth";
import { addDaysToDateOnly, businessDayStart, todayDateOnly } from "@/lib/dateOnly";
import { inventoryCountTypeLabel } from "@/lib/inventory/countScope";
import CountDashboardCharts from "./CountDashboardCharts";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const COUNT_TYPES = ["WEEKLY", "MONTHLY"] as const;

type CountAnalysisRow = {
  countId: string;
  countCode: string;
  countDate: Date;
  countType: "WEEKLY" | "MONTHLY";
  branchName: string;
  productId: string;
  productName: string;
  unit: string;
  expected: number;
  actual: number | null;
  variance: number | null;
  missing: number;
  deviation: number;
};

function isDate(value: string | undefined): value is string {
  return Boolean(value && DATE_ONLY.test(value));
}

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

export default async function BranchCountStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const current = params[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const allHistory = value("all") === "1";
  const today = todayDateOnly();
  const defaultFrom = addDaysToDateOnly(today, -29);
  const fromParam = value("from");
  const toParam = value("to");
  const requestedFrom = isDate(fromParam) ? fromParam : defaultFrom;
  const requestedTo = isDate(toParam) ? toParam : today;
  const dateFrom = allHistory ? undefined : requestedFrom <= requestedTo ? requestedFrom : requestedTo;
  const dateTo = allHistory ? undefined : requestedFrom <= requestedTo ? requestedTo : requestedFrom;
  const allowedBranchIds = await getAccessibleBranchIds();
  const requestedBranchId = value("branchId") ?? "";
  const selectedBranchId = requestedBranchId && (allowedBranchIds === null || allowedBranchIds.includes(requestedBranchId)) ? requestedBranchId : "";
  const selectedEmployeeId = value("employeeId") ?? "";
  const requestedType = value("type");
  const selectedType = COUNT_TYPES.includes(requestedType as (typeof COUNT_TYPES)[number]) ? requestedType as (typeof COUNT_TYPES)[number] : undefined;
  const branchFilter = selectedBranchId || (allowedBranchIds === null ? undefined : { in: allowedBranchIds });
  const dateFilter = dateFrom && dateTo ? { gte: businessDayStart(dateFrom), lt: businessDayStart(addDaysToDateOnly(dateTo, 1)) } : undefined;
  const countWhere: Prisma.InventoryCountWhereInput = {
    status: "CERRADO",
    branchId: branchFilter,
    countType: selectedType,
    ...(selectedEmployeeId ? { createdById: selectedEmployeeId } : {}),
    ...(dateFilter ? { countDate: dateFilter } : {}),
  };
  const movementWhere: Prisma.InventoryMovementWhereInput = {
    branchId: branchFilter,
    movementType: InventoryMovementTypeV2.SALE_CONSUMPTION,
    quantityDelta: { lt: 0 },
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };
  const branchWhere = allowedBranchIds === null ? { active: true } : { active: true, id: { in: allowedBranchIds } };

  const [branches, employees, counts, consumptionGroups] = await Promise.all([
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: {
        active: true,
        inventoryCountsCreated: {
          some: {
            branchId: branchFilter,
            ...(dateFilter ? { countDate: dateFilter } : {}),
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryCount.findMany({
      where: countWhere,
      orderBy: { countDate: "desc" },
      select: {
        id: true,
        code: true,
        countDate: true,
        countType: true,
        branch: { select: { name: true } },
        items: { select: { productId: true, previousQuantity: true, quantityCounted: true, product: { select: { name: true, unit: true, inventoryBaseUnit: true } } } },
      },
    }),
    prisma.inventoryMovement.groupBy({ where: movementWhere, by: ["branchId", "inventoryProductId", "unit"], _sum: { quantityDelta: true }, _count: { _all: true } }),
  ]);

  const rows: CountAnalysisRow[] = counts.flatMap((count) => count.items.map((item) => {
    const expected = Number(item.previousQuantity ?? 0);
    const actual = item.quantityCounted === null ? null : Number(item.quantityCounted);
    const variance = actual === null ? null : actual - expected;
    return {
      countId: count.id,
      countCode: count.code,
      countDate: count.countDate,
      countType: count.countType,
      branchName: count.branch.name,
      productId: item.productId,
      productName: item.product.name,
      unit: item.product.inventoryBaseUnit ?? item.product.unit,
      expected,
      actual,
      variance,
      missing: variance === null ? 0 : Math.max(0, -variance),
      deviation: variance === null ? 0 : expected > 0 ? Math.abs(variance) / expected : actual !== null && actual > 0 ? 1 : 0,
    };
  }));

  const consumptionGroupRows = consumptionGroups as Array<{
    branchId: string;
    inventoryProductId: string;
    unit: string;
    _sum: { quantityDelta: Prisma.Decimal | null };
    _count: { _all: number };
  }>;
  const productIds = [...new Set([...rows.map((row) => row.productId), ...consumptionGroupRows.map((row) => row.inventoryProductId)])];
  const productCodes = await prisma.inventoryProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true } });
  const productNames = new Map(productCodes.map((product) => [product.id, `${product.name} (${product.code})`]));
  const consumption = consumptionGroupRows.map((group) => ({
    name: productNames.get(group.inventoryProductId) ?? "Producto histórico",
    unit: group.unit,
    amount: Math.abs(Number(group._sum.quantityDelta ?? 0)),
    count: group._count._all,
  })).sort((a, b) => b.amount - a.amount);
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const consumptionByBranch = [...consumptionGroupRows.reduce((map, group) => {
    const current = map.get(group.branchId) ?? { name: branchNames.get(group.branchId) ?? "Sucursal histórica", movements: 0 };
    current.movements += group._count._all;
    map.set(group.branchId, current);
    return map;
  }, new Map<string, { name: string; movements: number }>()).values()]
    .sort((a, b) => b.movements - a.movements);
  const missingRows = rows.filter((row) => row.missing > 0).sort((a, b) => b.missing - a.missing);
  const absentRows = rows.filter((row) => row.expected > 0 && row.actual === 0).sort((a, b) => b.expected - a.expected);
  const deviationRows = rows.filter((row) => row.expected > 0 && row.deviation > 0.1).sort((a, b) => b.deviation - a.deviation);
  const branchSummary = [...rows.reduce((map, row) => {
    const current = map.get(row.branchName) ?? { name: row.branchName, affectedProducts: 0, missingRows: 0, measuredRows: 0, exactRows: 0 };
    if (row.actual !== null) {
      current.measuredRows += 1;
      if (row.variance === 0) current.exactRows += 1;
    }
    if (row.missing > 0) {
      current.affectedProducts += 1;
      current.missingRows += 1;
    }
    map.set(row.branchName, current);
    return map;
  }, new Map<string, { name: string; affectedProducts: number; missingRows: number; measuredRows: number; exactRows: number }>()).values()]
    .map((branch) => ({ ...branch, exactRate: branch.measuredRows > 0 ? Math.round((branch.exactRows / branch.measuredRows) * 100) : 0 }))
    .sort((a, b) => b.affectedProducts - a.affectedProducts || b.missingRows - a.missingRows);
  const dailySummary = [...rows.reduce((map, row) => {
    const key = row.countDate.toISOString().slice(0, 10);
    const current = map.get(key) ?? { label: formatDate(row.countDate), missingRows: 0, branches: new Set<string>() };
    if (row.missing > 0) {
      current.missingRows += 1;
      current.branches.add(row.branchName);
    }
    map.set(key, current);
    return map;
  }, new Map<string, { label: string; missingRows: number; branches: Set<string> }>()).values()]
    .map((day) => ({ label: day.label, missingRows: day.missingRows, affectedBranches: day.branches.size }))
    .reverse();
  const totalMeasured = rows.filter((row) => row.actual !== null).length;
  const exactRows = rows.filter((row) => row.actual !== null && row.variance === 0).length;
  const exactRate = totalMeasured > 0 ? Math.round((exactRows / totalMeasured) * 100) : 0;
  const missingByUnit = new Map<string, number>();
  for (const row of missingRows) missingByUnit.set(row.unit, (missingByUnit.get(row.unit) ?? 0) + row.missing);
  const missingSummary = [...missingByUnit.entries()].map(([unit, amount]) => formatQuantity(amount, unit)).join(" · ") || "0";
  const periodLabel = allHistory ? "Todo el historial" : `${dateFrom} a ${dateTo}`;
  const filterSuffix = [selectedBranchId && `branchId=${encodeURIComponent(selectedBranchId)}`, selectedEmployeeId && `employeeId=${encodeURIComponent(selectedEmployeeId)}`, selectedType && `type=${selectedType}`].filter(Boolean).join("&");
  const filterQuery = filterSuffix ? `&${filterSuffix}` : "";
  const quickPeriod = (from: string, to = today) => `/administration/inventory/branch-counts/statistics?from=${from}&to=${to}${filterQuery}`;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><Link href="/administration/inventory/branch-counts" className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface">← Conteos semanales y mensuales</Link><p className="text-xs font-bold uppercase tracking-widest text-primary">Inventario físico</p><h1 className="mt-1 text-3xl font-bold">Dashboard de conteos semanales</h1><p className="mt-2 max-w-3xl text-sm text-on-surface-variant">Resumen rápido para detectar qué está bien, qué sucursal presenta más faltantes y en qué lugar se está consumiendo más inventario.</p></div><Link href="/administration/inventory/branch-counts/new?type=WEEKLY" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold hover:bg-surface-container-high">Nuevo conteo semanal</Link></div>
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Filtros</h2><div className="flex flex-wrap gap-2 text-xs font-semibold"><Link href={quickPeriod(today)} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">Hoy</Link><Link href={quickPeriod(addDaysToDateOnly(today, -6))} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">7 días</Link><Link href={quickPeriod(defaultFrom)} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">30 días</Link><Link href={`/administration/inventory/branch-counts/statistics?all=1${filterQuery}`} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">Todo el historial</Link></div></div><form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-semibold text-on-surface-variant">Desde<input type="date" name="from" defaultValue={allHistory ? "" : dateFrom} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface" /></label><label className="text-xs font-semibold text-on-surface-variant">Hasta<input type="date" name="to" defaultValue={allHistory ? "" : dateTo} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface" /></label><label className="text-xs font-semibold text-on-surface-variant">Sucursal<select name="branchId" defaultValue={selectedBranchId} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-xs font-semibold text-on-surface-variant">Empleado<select name="employeeId" defaultValue={selectedEmployeeId} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface"><option value="">Todos los empleados</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label className="text-xs font-semibold text-on-surface-variant">Tipo de conteo<select name="type" defaultValue={selectedType ?? ""} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface"><option value="">Semanal y mensual</option>{COUNT_TYPES.map((type) => <option key={type} value={type}>{inventoryCountTypeLabel(type)}</option>)}</select></label><div className="sm:col-span-2 lg:col-span-5"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary">Aplicar filtros</button><span className="ml-3 text-xs text-on-surface-variant">Periodo: {periodLabel} · {counts.length.toLocaleString("es-MX")} conteos cerrados</span></div></form></section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><SummaryCard label="Conteos cerrados" value={counts.length.toLocaleString("es-MX")} detail="Dentro del periodo" /><SummaryCard label="Exactitud de captura" value={`${exactRate}%`} detail={`${exactRows.toLocaleString("es-MX")} productos exactos`} /><SummaryCard label="Productos faltantes" value={missingRows.length.toLocaleString("es-MX")} detail="Con diferencia negativa" /><SummaryCard label="Sucursal con más incidencias" value={branchSummary[0]?.name ?? "Sin datos"} detail={branchSummary[0] ? `${branchSummary[0].affectedProducts} productos afectados` : ""} /><SummaryCard label="Más movimientos de consumo" value={consumptionByBranch[0]?.name ?? "Sin datos"} detail={consumptionByBranch[0] ? `${consumptionByBranch[0].movements} movimientos` : ""} /></section>
        <CountDashboardCharts branchSummary={branchSummary} dailySummary={dailySummary} consumptionByBranch={consumptionByBranch} />
        <DataCard title="Prioridad de revisión"><p className="mb-3 text-xs text-on-surface-variant">Estas son las diferencias negativas más importantes del periodo. Abre el conteo para revisar el detalle.</p>{missingRows.length === 0 ? <Empty /> : <div className="space-y-2">{missingRows.slice(0, 10).map((row) => <Link key={`${row.countId}-${row.productId}`} href={`/administration/inventory/branch-counts/${row.countId}`} className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant px-3 py-3 transition hover:bg-surface-container-high"><div className="min-w-0"><p className="truncate font-semibold">{row.branchName} · {row.productName}</p><p className="text-xs text-on-surface-variant">{formatDate(row.countDate)} · {row.countCode}</p></div><span className="shrink-0 font-bold text-error">-{formatQuantity(row.missing, row.unit)}</span></Link>)}</div>}</DataCard>
        <section className="grid gap-4 lg:grid-cols-2"><DataCard title="Productos que no estaban"><p className="mb-3 text-xs text-on-surface-variant">Productos con existencia teórica mayor a cero y conteo físico en cero.</p><CountTable rows={absentRows} mode="missing" /></DataCard><DataCard title="Productos con mayor consumo registrado"><p className="mb-3 text-xs text-on-surface-variant">Consumo generado por ventas y recetas dentro del periodo seleccionado.</p>{consumption.length === 0 ? <Empty /> : <div className="space-y-3">{consumption.slice(0, 10).map((row, index) => <div key={`${row.name}-${row.unit}`}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{index + 1}. {row.name}</span><span className="shrink-0">{formatQuantity(row.amount, row.unit)}</span></div><p className="text-[11px] text-on-surface-variant">{row.count} movimientos de consumo</p></div>)}</div>}</DataCard></section>
        <DataCard title="Revisar mililitros, gramos o piezas"><p className="mb-3 text-xs text-on-surface-variant">La diferencia entre teórico y contado supera el 10%. Es una alerta para revisar captura, receta, unidad o merma.</p><CountTable rows={deviationRows} mode="deviation" /></DataCard>
        <DataCard title="Conteos analizados"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Sucursal</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Conteo</th><th className="px-3 py-2 text-right">Productos</th></tr></thead><tbody>{counts.map((count) => <tr key={count.id} className="border-t border-outline-variant"><td className="px-3 py-2">{formatDate(count.countDate)}</td><td className="px-3 py-2">{count.branch.name}</td><td className="px-3 py-2">{inventoryCountTypeLabel(count.countType)}</td><td className="px-3 py-2"><Link className="font-semibold text-primary hover:underline" href={`/administration/inventory/branch-counts/${count.id}`}>{count.code}</Link></td><td className="px-3 py-2 text-right">{count.items.length}</td></tr>)}</tbody></table></div>{counts.length === 0 && <Empty />}</DataCard>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-outline-variant bg-surface-container p-4"><p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="mt-2 truncate text-xl font-bold" title={value}>{value}</p><p className="mt-1 text-xs text-on-surface-variant">{detail}</p></div>; }
function DataCard({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-2xl border border-outline-variant bg-surface-container p-4"><h2 className="font-bold">{title}</h2><div className="mt-3">{children}</div></section>; }
function Empty() { return <p className="rounded-xl border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">No hay datos con estos filtros.</p>; }
function CountTable({ rows, mode }: { rows: CountAnalysisRow[]; mode: "missing" | "deviation" }) { if (rows.length === 0) return <Empty />; return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Sucursal</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2 text-right">Teórico</th><th className="px-3 py-2 text-right">Contado</th><th className="px-3 py-2 text-right">{mode === "missing" ? "Faltante" : "Desviación"}</th></tr></thead><tbody>{rows.slice(0, 20).map((row) => <tr key={`${row.countId}-${row.productId}`} className="border-t border-outline-variant"><td className="px-3 py-2 font-semibold">{row.productName}</td><td className="px-3 py-2 text-on-surface-variant">{row.branchName}</td><td className="px-3 py-2 text-on-surface-variant">{formatDate(row.countDate)}</td><td className="px-3 py-2 text-right">{formatQuantity(row.expected, row.unit)}</td><td className="px-3 py-2 text-right">{row.actual === null ? "Pendiente" : formatQuantity(row.actual, row.unit)}</td><td className={`px-3 py-2 text-right font-bold ${row.variance !== null && row.variance < 0 ? "text-error" : "text-tertiary-fixed-dim"}`}>{mode === "missing" ? formatQuantity(row.missing, row.unit) : `${(row.deviation * 100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>; }
