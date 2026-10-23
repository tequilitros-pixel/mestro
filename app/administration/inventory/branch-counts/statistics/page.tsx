import Link from "next/link";
import type { ReactNode } from "react";
import { InventoryMovementTypeV2, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessibleBranchIds } from "@/lib/auth";
import { addDaysToDateOnly, businessDayStart, todayDateOnly } from "@/lib/dateOnly";
import { inventoryCountTypeLabel } from "@/lib/inventory/countScope";
import {
  formatInventoryDashboardQuantity,
  type InventoryProductUnitConfig,
} from "@/lib/inventory/units";
import { costPerInventoryBaseUnit } from "@/lib/accounting/inventoryCost";
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
  notes?: string | null;
  product: InventoryProductUnitConfig & { unitCost?: unknown; normalizedContentPerUnit?: unknown };
  unitCost: number;
  expected: number;
  actual: number | null;
  variance: number | null;
  missing: number;
  missingCost: number;
  deviation: number;
};

type CountSummaryItem = {
  id: string;
  code: string;
  date: Date;
  countType: "WEEKLY" | "MONTHLY";
  branchName: string;
  createdByName: string;
  totalProducts: number;
  discrepantProducts: number;
  missingProducts: number;
  missingCost: number;
  exactRate: number;
  justifiedCount: number;
  unjustifiedCount: number;
};

type BranchAuditRow = {
  name: string;
  countsCount: number;
  affectedProducts: number;
  missingRows: number;
  measuredRows: number;
  exactRows: number;
  exactRate: number;
  missingCost: number;
  riskLevel: "CRITICAL" | "ATTENTION" | "HEALTHY";
};

function isDate(value: string | undefined): value is string {
  return Boolean(value && DATE_ONLY.test(value));
}

function formatQuantity(value: number, product: InventoryProductUnitConfig) {
  return formatInventoryDashboardQuantity(value, product);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

const formatMoney = (val: number) =>
  `$${val.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        createdBy: { select: { id: true, name: true } },
        items: {
          select: {
            productId: true,
            previousQuantity: true,
            quantityCounted: true,
            unitCostAtTime: true,
            costTotal: true,
            notes: true,
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
                unitCost: true,
                inventoryBaseUnit: true,
                handlingUnit: true,
                contentPerUnit: true,
                contentUnit: true,
                normalizedContentPerUnit: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryMovement.groupBy({
      where: movementWhere,
      by: ["branchId", "inventoryProductId", "unit"],
      _sum: { quantityDelta: true },
      _count: { _all: true },
    }),
  ]);

  // Análisis por renglón con costo unitario en moneda real ($ MXN)
  const rows: CountAnalysisRow[] = counts.flatMap((count) =>
    count.items.map((item) => {
      const expected = Number(item.previousQuantity ?? 0);
      const actual = item.quantityCounted === null ? null : Number(item.quantityCounted);
      const variance = actual === null ? null : actual - expected;
      const baseCost =
        costPerInventoryBaseUnit(item.product) ??
        (item.unitCostAtTime ? Number(item.unitCostAtTime) : 0);
      const missing = variance === null ? 0 : Math.max(0, -variance);
      const missingCost = missing * baseCost;

      return {
        countId: count.id,
        countCode: count.code,
        countDate: count.countDate,
        countType: count.countType,
        branchName: count.branch.name,
        productId: item.productId,
        productName: item.product.name,
        notes: item.notes,
        product: item.product,
        unitCost: baseCost,
        expected,
        actual,
        variance,
        missing,
        missingCost,
        deviation:
          variance === null
            ? 0
            : expected > 0
            ? Math.abs(variance) / expected
            : actual !== null && actual > 0
            ? 1
            : 0,
      };
    }),
  );

  // Consumo y catálogo de productos
  const consumptionGroupRows = consumptionGroups as Array<{
    branchId: string;
    inventoryProductId: string;
    unit: string;
    _sum: { quantityDelta: Prisma.Decimal | null };
    _count: { _all: number };
  }>;
  const productIds = [
    ...new Set([
      ...rows.map((row) => row.productId),
      ...consumptionGroupRows.map((row) => row.inventoryProductId),
    ]),
  ];
  const productCodes = await prisma.inventoryProduct.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      unitCost: true,
      inventoryBaseUnit: true,
      handlingUnit: true,
      contentPerUnit: true,
      contentUnit: true,
      normalizedContentPerUnit: true,
    },
  });
  const productNames = new Map(productCodes.map((p) => [p.id, `${p.name} (${p.code})`]));
  const productConfigs = new Map(productCodes.map((p) => [p.id, p]));

  // 1. TOP CONSUMO: Ordenado por valor financiero consumido ($) y velocidad de agotamiento
  const consumption = consumptionGroupRows
    .map((group) => {
      const p = productConfigs.get(group.inventoryProductId) ?? { inventoryBaseUnit: group.unit };
      const amount = Math.abs(Number(group._sum.quantityDelta ?? 0));
      const baseCost = costPerInventoryBaseUnit(p) ?? (p.unitCost ? Number(p.unitCost) : 0);
      const totalCost = amount * baseCost;
      return {
        id: group.inventoryProductId,
        name: productNames.get(group.inventoryProductId) ?? "Producto histórico",
        product: p,
        amount,
        totalCost,
        count: group._count._all,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.amount - a.amount);

  const branchNames = new Map(branches.map((b) => [b.id, b.name]));
  const consumptionByBranch = [
    ...consumptionGroupRows
      .reduce((map, group) => {
        const current = map.get(group.branchId) ?? {
          name: branchNames.get(group.branchId) ?? "Sucursal histórica",
          movements: 0,
        };
        current.movements += group._count._all;
        map.set(group.branchId, current);
        return map;
      }, new Map<string, { name: string; movements: number }>())
      .values(),
  ].sort((a, b) => b.movements - a.movements);

  // 2. RESUMEN CONTABLE POR SUCURSAL: Semáforo de Riesgo y Auditoría
  const branchSummaryMap = new Map<string, BranchAuditRow>();
  for (const row of rows) {
    const cur = branchSummaryMap.get(row.branchName) ?? {
      name: row.branchName,
      countsCount: 0,
      affectedProducts: 0,
      missingRows: 0,
      measuredRows: 0,
      exactRows: 0,
      exactRate: 100,
      missingCost: 0,
      riskLevel: "HEALTHY",
    };

    if (row.actual !== null) {
      cur.measuredRows += 1;
      if (row.variance === 0) cur.exactRows += 1;
    }
    if (row.missing > 0) {
      cur.affectedProducts += 1;
      cur.missingRows += 1;
      cur.missingCost += row.missingCost;
    }
    branchSummaryMap.set(row.branchName, cur);
  }

  // Contar cuántos conteos tuvo cada sucursal
  for (const c of counts) {
    const b = branchSummaryMap.get(c.branch.name);
    if (b) b.countsCount += 1;
  }

  const branchSummary: BranchAuditRow[] = Array.from(branchSummaryMap.values())
    .map((b) => {
      const exactRate = b.measuredRows > 0 ? Math.round((b.exactRows / b.measuredRows) * 100) : 100;
      let riskLevel: "CRITICAL" | "ATTENTION" | "HEALTHY" = "HEALTHY";
      if (b.missingCost >= 1000 || exactRate < 80) riskLevel = "CRITICAL";
      else if (b.missingCost >= 300 || exactRate < 92) riskLevel = "ATTENTION";
      return { ...b, exactRate, riskLevel };
    })
    .sort((a, b) => b.missingCost - a.missingCost || b.missingRows - a.missingRows);

  // 3. RANKING DE CONTEOS SEMANALES: ¿Cuál es el que más se está dificultando?
  const countSummaries: CountSummaryItem[] = counts
    .map((count) => {
      const countRows = rows.filter((r) => r.countId === count.id);
      const totalProducts = countRows.length;
      const measured = countRows.filter((r) => r.actual !== null);
      const exactItems = measured.filter((r) => r.variance === 0).length;
      const exactRate = measured.length > 0 ? Math.round((exactItems / measured.length) * 100) : 0;
      const missingProducts = countRows.filter((r) => r.missing > 0).length;
      const discrepantProducts = countRows.filter((r) => r.variance !== 0).length;
      const missingCost = countRows.reduce((sum, r) => sum + r.missingCost, 0);
      const justifiedCount = countRows.filter((r) => Boolean(r.notes?.trim())).length;
      const unjustifiedCount = countRows.filter((r) => r.missing > 0 && !r.notes?.trim()).length;

      return {
        id: count.id,
        code: count.code,
        date: count.countDate,
        countType: count.countType,
        branchName: count.branch.name,
        createdByName: count.createdBy?.name ?? "No registrado",
        totalProducts,
        discrepantProducts,
        missingProducts,
        missingCost,
        exactRate,
        justifiedCount,
        unjustifiedCount,
      };
    })
    .sort((a, b) => b.missingCost - a.missingCost || b.missingProducts - a.missingProducts);

  // 4. TOP PRODUCTOS CON MAYOR MERMA O FUGA (Agrupado por producto con impacto en $)
  const productLossMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      product: InventoryProductUnitConfig;
      totalMissing: number;
      totalMissingCost: number;
      branches: Set<string>;
      reasons: string[];
    }
  >();

  for (const r of rows) {
    if (r.missing > 0) {
      const cur = productLossMap.get(r.productId) ?? {
        productId: r.productId,
        productName: r.productName,
        product: r.product,
        totalMissing: 0,
        totalMissingCost: 0,
        branches: new Set<string>(),
        reasons: [],
      };
      cur.totalMissing += r.missing;
      cur.totalMissingCost += r.missingCost;
      cur.branches.add(r.branchName);
      if (r.notes?.trim()) cur.reasons.push(r.notes.trim());
      productLossMap.set(r.productId, cur);
    }
  }

  const topLossProducts = Array.from(productLossMap.values()).sort(
    (a, b) => b.totalMissingCost - a.totalMissingCost,
  );

  // Métricas globales
  const totalMeasured = rows.filter((row) => row.actual !== null).length;
  const exactRows = rows.filter((row) => row.actual !== null && row.variance === 0).length;
  const exactRate = totalMeasured > 0 ? Math.round((exactRows / totalMeasured) * 100) : 0;
  const totalMissingCost = rows.reduce((sum, r) => sum + r.missingCost, 0);
  const totalMissingProducts = rows.filter((r) => r.missing > 0).length;
  const worstBranch = branchSummary[0];
  const mostDifficultCount = countSummaries[0];
  const topDepletingProduct = consumption[0];
  const topLossProduct = topLossProducts[0];

  const missingRows = rows.filter((row) => row.missing > 0).sort((a, b) => b.missingCost - a.missingCost);
  const absentRows = rows.filter((row) => row.expected > 0 && row.actual === 0).sort((a, b) => b.expected - a.expected);
  const deviationRows = rows.filter((row) => row.expected > 0 && row.deviation > 0.1).sort((a, b) => b.deviation - a.deviation);

  const dailySummary = [
    ...rows
      .reduce((map, row) => {
        const key = row.countDate.toISOString().slice(0, 10);
        const current = map.get(key) ?? {
          label: formatDate(row.countDate),
          missingRows: 0,
          branches: new Set<string>(),
        };
        if (row.missing > 0) {
          current.missingRows += 1;
          current.branches.add(row.branchName);
        }
        map.set(key, current);
        return map;
      }, new Map<string, { label: string; missingRows: number; branches: Set<string> }>())
      .values(),
  ]
    .map((day) => ({
      label: day.label,
      missingRows: day.missingRows,
      affectedBranches: day.branches.size,
    }))
    .reverse();

  const periodLabel = allHistory ? "Todo el historial" : `${dateFrom} a ${dateTo}`;
  const filterSuffix = [
    selectedBranchId && `branchId=${encodeURIComponent(selectedBranchId)}`,
    selectedEmployeeId && `employeeId=${encodeURIComponent(selectedEmployeeId)}`,
    selectedType && `type=${selectedType}`,
  ]
    .filter(Boolean)
    .join("&");
  const filterQuery = filterSuffix ? `&${filterSuffix}` : "";
  const quickPeriod = (from: string, to = today) =>
    `/administration/inventory/branch-counts/statistics?from=${from}&to=${to}${filterQuery}`;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabecera */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/administration/inventory/branch-counts"
              className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
            >
              ← Conteos semanales y mensuales
            </Link>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Contaduría y Control de Inventario
            </p>
            <h1 className="mt-1 text-3xl font-bold">Resumen Semanal de Auditoría de Conteos</h1>
            <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
              Panel contable ejecutivo: identifica qué sucursal tiene problemas, qué conteo semanal
              presenta mayor merma o descuadre, y qué insumo se está agotando más rápido.
            </p>
          </div>
          <Link
            href="/administration/inventory/branch-counts/new?type=WEEKLY"
            className="rounded-xl border border-outline-variant bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 transition"
          >
            Nuevo conteo semanal
          </Link>
        </div>

        {/* Filtros */}
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Filtros de periodo y alcance</h2>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link href={quickPeriod(today)} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">
                Hoy
              </Link>
              <Link href={quickPeriod(addDaysToDateOnly(today, -6))} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">
                7 días
              </Link>
              <Link href={quickPeriod(defaultFrom)} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">
                30 días
              </Link>
              <Link href={`/administration/inventory/branch-counts/statistics?all=1${filterQuery}`} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">
                Todo el historial
              </Link>
            </div>
          </div>
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-on-surface-variant">
              Desde
              <input type="date" name="from" defaultValue={allHistory ? "" : dateFrom} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface" />
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              Hasta
              <input type="date" name="to" defaultValue={allHistory ? "" : dateTo} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface" />
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              Sucursal
              <select name="branchId" defaultValue={selectedBranchId} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface">
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              Empleado
              <select name="employeeId" defaultValue={selectedEmployeeId} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface">
                <option value="">Todos los empleados</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              Tipo de conteo
              <select name="type" defaultValue={selectedType ?? ""} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface">
                <option value="">Semanal y mensual</option>
                {COUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{inventoryCountTypeLabel(t)}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-3 pt-1">
              <div>
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary">
                  Aplicar filtros
                </button>
                <span className="ml-3 text-xs text-on-surface-variant">
                  Periodo: {periodLabel} · {counts.length.toLocaleString("es-MX")} conteos cerrados
                </span>
              </div>
            </div>
          </form>
        </section>

        {/* Tarjetas Ejecutivas de Decisión Rápida (Contaduría) */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard
            label="Pérdida en Faltantes"
            value={formatMoney(totalMissingCost)}
            detail={`${totalMissingProducts.toLocaleString("es-MX")} productos con descuadre`}
            highlight="error"
          />
          <SummaryCard
            label="Sucursal con más Problemas"
            value={worstBranch?.name ?? "Sin incidencias"}
            detail={worstBranch ? `${formatMoney(worstBranch.missingCost)} faltante (${worstBranch.missingRows} renglones)` : "Sin faltantes"}
            highlight={worstBranch && worstBranch.missingCost > 0 ? "error" : "normal"}
          />
          <SummaryCard
            label="Conteo más Conflictivo"
            value={mostDifficultCount ? mostDifficultCount.branchName : "Ninguno"}
            detail={mostDifficultCount && mostDifficultCount.missingCost > 0 ? `${formatDate(mostDifficultCount.date)} · ${formatMoney(mostDifficultCount.missingCost)}` : "Todos al corriente"}
            highlight={mostDifficultCount && mostDifficultCount.missingCost > 0 ? "error" : "normal"}
          />
          <SummaryCard
            label="Mayor Merma / Fuga"
            value={topLossProduct ? topLossProduct.productName : "Ninguno"}
            detail={topLossProduct ? `${formatMoney(topLossProduct.totalMissingCost)} (${formatQuantity(-topLossProduct.totalMissing, topLossProduct.product)})` : "Sin pérdidas registradas"}
            highlight={topLossProduct ? "warning" : "normal"}
          />
          <SummaryCard
            label="Mayor Agotamiento"
            value={topDepletingProduct ? topDepletingProduct.name : "Sin consumo"}
            detail={topDepletingProduct ? `${formatMoney(topDepletingProduct.totalCost)} (${formatQuantity(topDepletingProduct.amount, topDepletingProduct.product)})` : "Sin datos de ventas"}
            highlight="normal"
          />
          <SummaryCard
            label="Exactitud Global"
            value={`${exactRate}%`}
            detail={`${exactRows.toLocaleString("es-MX")} de ${totalMeasured.toLocaleString("es-MX")} exactos`}
            highlight={exactRate >= 90 ? "success" : exactRate >= 75 ? "warning" : "error"}
          />
        </section>

        {/* Gráficos de tendencias */}
        <CountDashboardCharts
          branchSummary={branchSummary}
          dailySummary={dailySummary}
          consumptionByBranch={consumptionByBranch}
        />

        {/* SECCIÓN 1: SEMÁFORO CONTABLE POR SUCURSAL */}
        <DataCard title="Semáforo Contable por Sucursal: ¿Qué sucursal está teniendo problemas?">
          <p className="mb-4 text-xs text-on-surface-variant">
            Auditoría consolidada por punto de venta. Te permite evaluar de un vistazo el riesgo
            operativo, la exactitud de inventario y el impacto económico total de los faltantes.
          </p>
          {branchSummary.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2.5">Sucursal</th>
                    <th className="px-3 py-2.5 text-center">Estado / Riesgo</th>
                    <th className="px-3 py-2.5 text-center">Conteos</th>
                    <th className="px-3 py-2.5 text-right">Exactitud</th>
                    <th className="px-3 py-2.5 text-right">Productos Afectados</th>
                    <th className="px-3 py-2.5 text-right">Pérdida en Faltantes ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {branchSummary.map((b) => (
                    <tr key={b.name} className="hover:bg-surface-container-high/40 transition">
                      <td className="px-3 py-3 font-semibold text-on-surface">{b.name}</td>
                      <td className="px-3 py-3 text-center">
                        {b.riskLevel === "CRITICAL" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 text-xs font-bold text-error">
                            🔴 Crítico
                          </span>
                        ) : b.riskLevel === "ATTENTION" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                            🟡 Atención
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                            🟢 Saludable
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-on-surface-variant">
                        {b.countsCount}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            b.exactRate >= 90
                              ? "text-emerald-400"
                              : b.exactRate >= 75
                              ? "text-amber-400"
                              : "text-error"
                          }`}
                        >
                          {b.exactRate}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-on-surface-variant">
                        {b.affectedProducts > 0 ? (
                          <span className="font-semibold text-error">
                            {b.affectedProducts} de {b.measuredRows}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {b.missingCost > 0 ? (
                          <span className="text-error">{formatMoney(b.missingCost)}</span>
                        ) : (
                          <span className="text-emerald-400">$0.00</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>

        {/* SECCIÓN 2: RANKING DE CONTEOS SEMANALES CONFLICTIVOS */}
        <DataCard title="Ranking de Conteos Semanales: ¿Qué conteo es el que más se está dificultando?">
          <p className="mb-4 text-xs text-on-surface-variant">
            Ordenado de mayor a menor descuadre monetario para que audites directamente el corte con
            más problemas y verifiques justificaciones o tomes medidas con el personal.
          </p>
          {countSummaries.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-outline-variant text-xs uppercase tracking-wide text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2.5">Conteo / Código</th>
                    <th className="px-3 py-2.5">Sucursal</th>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Responsable</th>
                    <th className="px-3 py-2.5 text-right">Exactitud</th>
                    <th className="px-3 py-2.5 text-right">Descuadres</th>
                    <th className="px-3 py-2.5 text-right">Faltante en Dinero ($)</th>
                    <th className="px-3 py-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {countSummaries.slice(0, 15).map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-high/40 transition">
                      <td className="px-3 py-3 font-semibold">
                        <Link
                          href={`/administration/inventory/branch-counts/${c.id}`}
                          className="text-primary hover:underline"
                        >
                          {c.code}
                        </Link>
                        <span className="block text-[11px] font-normal text-on-surface-variant">
                          {inventoryCountTypeLabel(c.countType)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-on-surface">{c.branchName}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{formatDate(c.date)}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{c.createdByName}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            c.exactRate >= 90
                              ? "text-emerald-400"
                              : c.exactRate >= 75
                              ? "text-amber-400"
                              : "text-error"
                          }`}
                        >
                          {c.exactRate}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {c.discrepantProducts > 0 ? (
                          <div>
                            <span className="font-semibold text-error">
                              {c.missingProducts} faltantes
                            </span>
                            {c.unjustifiedCount > 0 ? (
                              <span className="block text-[11px] text-amber-400">
                                {c.unjustifiedCount} sin justificar
                              </span>
                            ) : (
                              <span className="block text-[11px] text-emerald-400">
                                Todo justificado
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-400">0 descuadres</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {c.missingCost > 0 ? (
                          <span className="text-error">{formatMoney(c.missingCost)}</span>
                        ) : (
                          <span className="text-emerald-400">$0.00</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link
                          href={`/administration/inventory/branch-counts/${c.id}`}
                          className="rounded-lg border border-outline-variant bg-surface-container px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container-high transition"
                        >
                          Auditar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>

        {/* SECCIÓN 3: TOP PRODUCTOS CON MAYOR MERMA Y TOP PRODUCTOS MÁS AGOTADOS */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Top Fuga / Merma */}
          <DataCard title="Top Productos con Mayor Fuga o Merma ($ MXN)">
            <p className="mb-3 text-xs text-on-surface-variant">
              Insumos y productos que representan la mayor pérdida económica en los inventarios
              semanales.
            </p>
            {topLossProducts.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-3">
                {topLossProducts.slice(0, 10).map((prod, idx) => (
                  <div
                    key={prod.productId}
                    className="rounded-xl border border-outline-variant p-3 hover:bg-surface-container-high/40 transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-on-surface">
                          {idx + 1}. {prod.productName}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Sucursales: {Array.from(prod.branches).join(", ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-error">{formatMoney(prod.totalMissingCost)}</p>
                        <p className="text-xs text-on-surface-variant">
                          {formatQuantity(-prod.totalMissing, prod.product)}
                        </p>
                      </div>
                    </div>
                    {prod.reasons.length > 0 && (
                      <p className="mt-2 text-[11px] text-amber-400 bg-amber-500/10 rounded-md px-2 py-0.5 inline-block">
                        Motivos registrados: {prod.reasons.slice(0, 2).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DataCard>

          {/* Top Consumo / Rotación rápida */}
          <DataCard title="Top Productos que más Rápido se están Agotando">
            <p className="mb-3 text-xs text-on-surface-variant">
              Productos de mayor rotación y consumo por ventas o recetas dentro del periodo.
            </p>
            {consumption.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-3">
                {consumption.slice(0, 10).map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-outline-variant p-3 hover:bg-surface-container-high/40 transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-on-surface">
                          {idx + 1}. {item.name}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {item.count} órdenes o recetas aplicadas
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-primary">{formatMoney(item.totalCost)}</p>
                        <p className="text-xs text-on-surface-variant font-medium">
                          {formatQuantity(item.amount, item.product)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </section>

        {/* SECCIÓN 4: PRIORIDAD DE REVISIÓN INDIVIDUAL (DESCUADRES MÁS FUERTES) */}
        <DataCard title="Partidas Específicas con Mayor Descuadre Negativo">
          <p className="mb-3 text-xs text-on-surface-variant">
            Renglones individuales que ameritan investigación inmediata con el gerente de sucursal.
          </p>
          {missingRows.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {missingRows.slice(0, 10).map((row) => (
                <Link
                  key={`${row.countId}-${row.productId}`}
                  href={`/administration/inventory/branch-counts/${row.countId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant px-3 py-3 transition hover:bg-surface-container-high"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {row.branchName} · {row.productName}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDate(row.countDate)} · {row.countCode}
                      {row.notes ? ` · Justificación: ${row.notes}` : " · Sin justificar"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-error">{formatMoney(row.missingCost)}</p>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {formatQuantity(-row.missing, row.product)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DataCard>

        {/* SECCIÓN 5: DESVIACIONES Y PRODUCTOS AGOTADOS */}
        <section className="grid gap-4 lg:grid-cols-2">
          <DataCard title="Productos que se agotaron totalmente (Conteo en Cero)">
            <p className="mb-3 text-xs text-on-surface-variant">
              Insumos con existencia teórica en sistema que salieron en 0 en el conteo físico.
            </p>
            <CountTable rows={absentRows} mode="missing" />
          </DataCard>

          <DataCard title="Desviaciones mayores al 10%">
            <p className="mb-3 text-xs text-on-surface-variant">
              Discrepancia porcentual entre teórico y contado que excede la tolerancia habitual.
            </p>
            <CountTable rows={deviationRows} mode="deviation" />
          </DataCard>
        </section>

        {/* SECCIÓN 6: TODOS LOS CONTEOS ANALIZADOS */}
        <DataCard title="Todos los Conteos Analizados">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Sucursal</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Conteo</th>
                  <th className="px-3 py-2 text-right">Productos</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((count) => (
                  <tr key={count.id} className="border-t border-outline-variant">
                    <td className="px-3 py-2">{formatDate(count.countDate)}</td>
                    <td className="px-3 py-2">{count.branch.name}</td>
                    <td className="px-3 py-2">{inventoryCountTypeLabel(count.countType)}</td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/administration/inventory/branch-counts/${count.id}`}
                      >
                        {count.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{count.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {counts.length === 0 && <Empty />}
        </DataCard>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  highlight = "normal",
}: {
  label: string;
  value: string;
  detail: string;
  highlight?: "normal" | "error" | "warning" | "success";
}) {
  const valueColor =
    highlight === "error"
      ? "text-error"
      : highlight === "warning"
      ? "text-amber-400"
      : highlight === "success"
      ? "text-emerald-400"
      : "text-on-surface";

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className={`mt-2 truncate text-xl font-bold ${valueColor}`} title={value}>
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
    </div>
  );
}

function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      <h2 className="font-bold text-lg text-on-surface">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty() {
  return (
    <p className="rounded-xl border border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
      No hay datos con los filtros seleccionados.
    </p>
  );
}

function CountTable({
  rows,
  mode,
}: {
  rows: CountAnalysisRow[];
  mode: "missing" | "deviation";
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="px-3 py-2">Producto</th>
            <th className="px-3 py-2">Sucursal</th>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2 text-right">Teórico</th>
            <th className="px-3 py-2 text-right">Contado</th>
            <th className="px-3 py-2 text-right">
              {mode === "missing" ? "Faltante" : "Desviación"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row) => (
            <tr key={`${row.countId}-${row.productId}`} className="border-t border-outline-variant">
              <td className="px-3 py-2">
                <span className="font-semibold text-on-surface">{row.productName}</span>
                {row.notes && (
                  <span className="block text-xs font-medium text-amber-500">
                    Motivo: {row.notes}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-on-surface-variant">{row.branchName}</td>
              <td className="px-3 py-2 text-on-surface-variant">{formatDate(row.countDate)}</td>
              <td className="px-3 py-2 text-right">{formatQuantity(row.expected, row.product)}</td>
              <td className="px-3 py-2 text-right">
                {row.actual === null ? "Pendiente" : formatQuantity(row.actual, row.product)}
              </td>
              <td
                className={`px-3 py-2 text-right font-bold ${
                  row.variance !== null && row.variance < 0
                    ? "text-error"
                    : "text-tertiary-fixed-dim"
                }`}
              >
                {mode === "missing"
                  ? formatQuantity(-row.missing, row.product)
                  : `${(row.deviation * 100).toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
