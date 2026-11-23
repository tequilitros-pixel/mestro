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
import { costPerInventoryBaseUnit, resolveInventoryCountUnitCost } from "@/lib/accounting/inventoryCost";
import { isPotentialInventoryCountOutlier, isImplausibleInventoryIncrease, countAmountInPesos } from "@/lib/inventory/countAudit";
import { consolidateSaleConsumption } from "@/lib/inventory/saleConsumptionSummary";
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
  snapshotInPresentation: boolean;
  expected: number;
  actual: number | null;
  variance: number | null;
  missing: number;
  missingCost: number;
  surplus: number;
  surplusCost: number;
  reviewCost: number;
  requiresReview: boolean;
  staleCapture: boolean;
  reviewReasons: string[];
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
  reviewCost: number;
  staleRows: number;
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
  reviewCost: number;
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
  // Un resumen semanal debe mostrar siete días completos por defecto.
  const defaultFrom = addDaysToDateOnly(today, -6);
  const monthFrom = addDaysToDateOnly(today, -29);
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
    countType: selectedType ?? "WEEKLY",
    ...(selectedEmployeeId ? { createdById: selectedEmployeeId } : {}),
    ...(dateFilter ? { countDate: dateFilter } : {}),
  };
  const movementWhere: Prisma.InventoryMovementWhereInput = {
    branchId: branchFilter,
    movementType: { in: [InventoryMovementTypeV2.SALE_CONSUMPTION, InventoryMovementTypeV2.SALE_REVERSAL] },
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
        declarations: { select: { id: true } },
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
      by: ["branchId", "inventoryProductId", "unit", "movementType"],
      _sum: { quantityDelta: true },
      _count: { _all: true },
    }),
  ]);

  // Comparar capturas físicas con el saldo NETO de movimientos posteriores hasta el cierre.
  // Un saldo conciliado al cierre no equivale necesariamente al saldo en el
  // momento del conteo. Las diferencias de esas capturas requieren revisión.
  const postCaptureMovements = counts.length > 0
    ? await prisma.$queryRaw<Array<{ countId: string; productId: string }>>`
        SELECT i."countId" AS "countId", i."productId" AS "productId"
        FROM "InventoryCountItem" i
        JOIN "InventoryCount" c ON c.id = i."countId"
        JOIN "InventoryMovement" m
          ON m."branchId" = c."branchId"
         AND m."inventoryProductId" = i."productId"
         AND m."createdAt" > i."countedAt"
         AND m."createdAt" < c."closedAt"
         AND m."sourceId" <> c.id
        WHERE i."countId" IN (${Prisma.join(counts.map((count) => count.id))})
        GROUP BY i."countId", i."productId"
        HAVING SUM(m."quantityDelta") <> 0
      `
    : [];
  const staleCaptureKeys = new Set(
    postCaptureMovements.map((row) => `${row.countId}:${row.productId}`),
  );

  // Análisis por renglón con costo unitario en moneda real ($ MXN)
  const rows: CountAnalysisRow[] = counts.flatMap((count) =>
    count.items.map((item) => {
      const expected = Number(item.previousQuantity ?? 0);
      const actual = item.quantityCounted === null ? null : Number(item.quantityCounted);
      const variance = actual === null ? null : actual - expected;
      const snapshotCost = resolveInventoryCountUnitCost(item.product, item.unitCostAtTime);
      const baseCost = snapshotCost.unitCost;
      const missing = variance === null ? 0 : Math.max(0, -variance);
      const surplus = variance === null ? 0 : Math.max(0, variance);
      const missingCost = countAmountInPesos(missing, baseCost);
      const surplusCost = countAmountInPesos(surplus, baseCost);
      const presentation = item.product.normalizedContentPerUnit === null
        ? null : Number(item.product.normalizedContentPerUnit);
      const outlier = isPotentialInventoryCountOutlier({
        expected, counted: actual, normalizedContentPerUnit: presentation, missingCost,
      }) || (actual !== null && isImplausibleInventoryIncrease({
        expected: Math.max(0, expected),
        captured: actual,
        normalizedContentPerUnit: presentation,
        costPerBaseUnit: baseCost,
      }));
      const staleCapture = staleCaptureKeys.has(`${count.id}:${item.productId}`);
      const reviewReasons = [
        ...(outlier ? ["Saldo extraordinario"] : []),
        ...(staleCapture ? ["Cambió el saldo después de la captura física"] : []),
      ];
      const requiresReview = reviewReasons.length > 0;
      const reviewCost = requiresReview ? missingCost + surplusCost : 0;

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
        snapshotInPresentation: snapshotCost.snapshotInPresentation,
        expected,
        actual,
        variance,
        missing,
        missingCost,
        surplus,
        surplusCost,
        reviewCost,
        requiresReview,
        staleCapture,
        reviewReasons,
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
    movementType: InventoryMovementTypeV2;
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

  // 1. TOP CONSUMO: un producto puede tener ventas en varias sucursales.
  // Agrupamos por artículo+unidad y restamos las devoluciones antes de
  // valorizar. Un movimiento de inventario no equivale a un ticket POS.
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));
  const consumption = consolidateSaleConsumption(
    consumptionGroupRows.map((group) => ({
      inventoryProductId: group.inventoryProductId,
      branchId: group.branchId,
      unit: group.unit,
      movementType: group.movementType as "SALE_CONSUMPTION" | "SALE_REVERSAL",
      quantityDelta: Number(group._sum.quantityDelta ?? 0),
      movements: group._count._all,
    })),
  )
    .map((group) => {
      const p = productConfigs.get(group.inventoryProductId) ?? {
        unit: group.unit,
        inventoryBaseUnit: group.unit,
        unitCost: null,
      };
      const baseCost = costPerInventoryBaseUnit(p) ?? (p.unitCost ? Number(p.unitCost) : 0);
      return {
        id: `${group.inventoryProductId}:${group.unit}`,
        name: productNames.get(group.inventoryProductId) ?? "Producto histórico",
        product: p,
        amount: group.amount,
        totalCost: group.amount * baseCost,
        count: group.saleMovements,
        reversals: group.reversalMovements,
        branches: group.branches.map((row) => ({
          name: branchNames.get(row.branchId) ?? "Sucursal histórica",
          amount: row.amount,
        })),
      };
    })
    .filter((product) => product.amount > 0)
    .sort((a, b) => b.totalCost - a.totalCost || b.amount - a.amount);

  const consumptionByBranch = [
    ...consumptionGroupRows
      .reduce((map, group) => {
        // Solo contar descuentos por venta: las devoluciones no son consumo.
        if (group.movementType !== InventoryMovementTypeV2.SALE_CONSUMPTION) return map;
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
      reviewCost: 0,
      riskLevel: "HEALTHY",
    };

    if (row.actual !== null) {
      cur.measuredRows += 1;
      if (row.variance === 0) cur.exactRows += 1;
    }
    if (row.requiresReview) {
      cur.reviewCost += row.reviewCost;
    }
    if (row.missing > 0 && !row.requiresReview) {
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
      // La coincidencia exacta (hasta el ml/g) no es una medida de riesgo financiero.
      if (b.missingCost >= 1000) riskLevel = "CRITICAL";
      else if (b.missingCost >= 300 || b.reviewCost > 0) riskLevel = "ATTENTION";
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
      const missingProducts = countRows.filter((r) => r.missing > 0 && !r.requiresReview).length;
      const discrepantProducts = countRows.filter((r) => r.variance !== null && r.variance !== 0).length;
      const missingCost = countRows.reduce((sum, r) => sum + (r.requiresReview ? 0 : r.missingCost), 0);
      const reviewCost = countRows.reduce((sum, r) => sum + r.reviewCost, 0);
      const staleRows = countRows.filter((r) => r.staleCapture).length;
      const justifiedCount = countRows.filter((r) => Boolean(r.notes?.trim())).length;
      const unjustifiedCount = countRows.filter((r) => r.missing > 0 && !r.requiresReview && !r.notes?.trim()).length;

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
        reviewCost,
        staleRows,
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
    if (r.missing > 0 && !r.requiresReview) {
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
  const staleCaptureRows = rows.filter((row) => row.staleCapture);
  const staleCaptureCounts = new Set(staleCaptureRows.map((row) => row.countId)).size;
  const reviewRows = rows.filter((row) => row.requiresReview && row.reviewCost > 0).sort((a, b) => b.reviewCost - a.reviewCost);
  const totalReviewCost = reviewRows.reduce((sum, row) => sum + row.reviewCost, 0);
  const totalMissingCost = rows.reduce((sum, r) => sum + (r.requiresReview ? 0 : r.missingCost), 0);
  const totalSurplusCost = rows.reduce((sum, r) => sum + (r.requiresReview ? 0 : r.surplusCost), 0);
  const totalMissingProducts = rows.filter((r) => r.missing > 0 && !r.requiresReview).length;
  const worstBranch = branchSummary[0];
  const mostDifficultCount = countSummaries[0];

  const missingRows = rows.filter((row) => row.missing > 0 && !row.requiresReview).sort((a, b) => b.missingCost - a.missingCost);
  const absentRows = rows.filter((row) => !row.requiresReview && row.expected > 0 && row.actual === 0).sort((a, b) => b.expected - a.expected);
  const deviationRows = rows.filter((row) => !row.requiresReview && row.expected > 0 && row.deviation > 0.1).sort((a, b) => b.deviation - a.deviation);

  const dailySummary = [
    ...rows
      .reduce((map, row) => {
        const key = row.countDate.toISOString().slice(0, 10);
        const current = map.get(key) ?? {
          label: formatDate(row.countDate),
          missingRows: 0,
          branches: new Set<string>(),
        };
        if (row.missing > 0 && !row.requiresReview) {
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

  const legacyCounts = counts.filter((count) => count.declarations.length === 0);
  const missingCostRows = rows.filter((row) =>
    row.actual !== null && row.variance !== 0 && row.unitCost <= 0,
  );
  const presentationCostSnapshotRows = rows.filter((row) => row.snapshotInPresentation);
  const groupedDates = counts.reduce((map, count) => {
    const key = `${count.branchId}:${count.countDate.toISOString().slice(0, 10)}:${count.countType}`;
    const matches = map.get(key) ?? [];
    matches.push(count);
    map.set(key, matches);
    return map;
  }, new Map<string, typeof counts>());
  const repeatedCountDays = [...groupedDates.values()].filter((group) => group.length > 1);

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
              Últimos 7 días por defecto. Los faltantes son estimaciones de diferencias entre el sistema y el conteo;
              los saldos extraordinarios se identifican por separado hasta verificar su origen.
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
              <Link href={quickPeriod(monthFrom)} className="rounded-lg border border-outline-variant px-2.5 py-1.5 hover:bg-surface-container-high">
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
                <option value="">Solo semanales (predeterminado)</option>
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
            label="Faltantes estimados"
            value={formatMoney(totalMissingCost)}
            detail={`${totalMissingProducts.toLocaleString("es-MX")} renglones sin alertas extraordinarias ni capturas desactualizadas · pendientes de conciliar`}
            highlight="error"
          />
          <SummaryCard
            label="Sucursal con más Problemas"
            value={worstBranch?.name ?? "Sin incidencias"}
            detail={worstBranch ? `${formatMoney(worstBranch.missingCost)} estimados (${worstBranch.missingRows} renglones)` : "Sin faltantes"}
            highlight={worstBranch && worstBranch.missingCost > 0 ? "error" : "normal"}
          />
          <SummaryCard
            label="Conteo más Conflictivo"
            value={mostDifficultCount ? mostDifficultCount.branchName : "Ninguno"}
            detail={mostDifficultCount && mostDifficultCount.missingCost > 0 ? `${formatDate(mostDifficultCount.date)} · ${formatMoney(mostDifficultCount.missingCost)}` : "Todos al corriente"}
            highlight={mostDifficultCount && mostDifficultCount.missingCost > 0 ? "error" : "normal"}
          />
          <SummaryCard
            label="Diferencias por revisar"
            value={formatMoney(totalReviewCost)}
            detail={`${reviewRows.length} partidas con diferencias en revisión · separadas de faltantes estimados`}
            highlight={reviewRows.length > 0 ? "warning" : "normal"}
          />
          <SummaryCard
            label="Sobrantes estimados"
            value={formatMoney(totalSurplusCost)}
            detail="Aumentos físicos ordinarios frente al saldo teórico · pendientes de conciliar"
            highlight="normal"
          />
          <SummaryCard
            label="Coincidencia exacta"
            value={`${exactRate}%`}
            detail={`${exactRows.toLocaleString("es-MX")} de ${totalMeasured.toLocaleString("es-MX")} renglones iguales hasta el ml, g o pieza; no es un porcentaje de merma`}
            highlight="normal"
          />
        </section>

        {reviewRows.length > 0 && (
          <DataCard title="Revisar diferencias extraordinarias y capturas desactualizadas">
            <p className="mb-4 text-sm text-on-surface-variant">
              Los registros originales se conservan. Se separan los saldos extraordinarios y
              las partidas donde el saldo cambió por ventas, entradas u otros movimientos entre la captura
              física y el cierre. No es correcto reconocer esas diferencias como pérdidas
              sin conciliarlas; el importe es bruto y no modifica las existencias.
            </p>
            <p className="mb-3 font-bold text-amber-400">{formatMoney(totalReviewCost)} pendientes de verificación ({reviewRows.length} registros)</p>
            <div className="space-y-2">
              {reviewRows.slice(0, 12).map((row) => (
                <Link
                  key={`${row.countId}:${row.productId}`}
                  href={`/administration/inventory/branch-counts/${row.countId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant px-3 py-3 text-sm transition hover:bg-surface-container-high"
                >
                  <span className="min-w-0">
                    <strong className="block">{row.productName} · {row.branchName}</strong>
                    <span className="block text-xs text-on-surface-variant">{formatDate(row.countDate)} · {row.countCode}</span>
                    <span className="block text-xs text-on-surface-variant">Teórico: {formatQuantity(row.expected, row.product)} · Contado: {formatQuantity(row.actual ?? 0, row.product)}</span>
                    <span className="block text-xs font-medium text-amber-400">{row.reviewReasons.join(" · ")}</span>
                  </span>
                  <span className="font-bold text-amber-400">{row.surplus > 0 ? "Sobrante" : "Faltante"}: {formatMoney(row.reviewCost)} en revisión</span>
                </Link>
              ))}
            </div>
          </DataCard>
        )}

        {(legacyCounts.length > 0 || missingCostRows.length > 0 || repeatedCountDays.length > 0 || staleCaptureRows.length > 0 || presentationCostSnapshotRows.length > 0) && (
          <DataCard title="Calidad de datos del historial">
            <p className="mb-3 text-sm text-on-surface-variant">
              Advertencias de auditoría: estos datos pueden afectar la interpretación de los importes
              y porcentajes, pero no se alteran ni se eliminan automáticamente.
            </p>
            <div className="space-y-3 text-sm text-on-surface">
              {staleCaptureRows.length > 0 && (
                <p><strong>{staleCaptureRows.length} productos en {staleCaptureCounts} conteos con cambios netos de saldo posteriores a la captura.</strong>
                  {" "}La comparación con el saldo del cierre puede producir faltantes o sobrantes engañosos.
                  {" "}Estas diferencias se muestran en revisión y no se suman a faltantes ordinarios.
                </p>
              )}
              {presentationCostSnapshotRows.length > 0 && (
                <p><strong>{presentationCostSnapshotRows.length} registros históricos con costo de presentación en vez de costo por unidad base.</strong>
                  {" "}El reporte normaliza esos importes al leerlos (por ejemplo, precio por botella dividido entre sus mililitros),
                  sin modificar las capturas originales.
                </p>
              )}
              {missingCostRows.length > 0 && (
                <p><strong>{missingCostRows.length} renglones con diferencias sin costo configurado.</strong>
                  {" "}Su diferencia física existe, pero el reporte no puede valorizarla en pesos.
                  {" "}Productos: {[...new Set(missingCostRows.map((row) => row.productName))].join(", ")}.
                </p>
              )}
              {legacyCounts.length > 0 && (
                <div>
                  <p><strong>{legacyCounts.length} conteos históricos sin declaraciones de conciliación V2.</strong>
                    {" "}Conservar como historial; revisar la trazabilidad antes de usarlos como referencia contable.
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {legacyCounts.map((count) => count.code).join(" · ")}
                  </p>
                </div>
              )}
              {repeatedCountDays.length > 0 && (
                <div>
                  <p><strong>{repeatedCountDays.length} fechas con más de un conteo cerrado en la misma sucursal.</strong>
                    {" "}No se debe interpretar cada uno como una semana distinta.
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {repeatedCountDays.map((group) =>
                      `${group[0].branch.name}: ${formatDate(group[0].countDate)} (${group.map((count) => count.code).join(", ")})`,
                    ).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          </DataCard>
        )}

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
                    <th className="px-3 py-2.5 text-right">Coincidencia exacta</th>
                    <th className="px-3 py-2.5 text-right">Renglones con faltante</th>
                    <th className="px-3 py-2.5 text-right">Faltantes estimados (MXN)</th>
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
                          className="font-semibold text-on-surface"
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
                        {b.reviewCost > 0 && (
                          <span className="block text-xs font-medium text-amber-400">
                            {formatMoney(b.reviewCost)} en revisión
                          </span>
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
                    <th className="px-3 py-2.5 text-right">Coincidencia exacta</th>
                    <th className="px-3 py-2.5 text-right">Descuadres</th>
                    <th className="px-3 py-2.5 text-right">Faltante estimado (MXN)</th>
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
                          className="font-semibold text-on-surface"
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
                                Sin faltantes ordinarios sin justificar
                              </span>
                            )}
                            {c.staleRows > 0 && (
                              <span className="block text-[11px] font-medium text-amber-400">
                                {c.staleRows} capturas con movimientos posteriores
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
                        {c.reviewCost > 0 && (
                          <span className="block text-xs font-medium text-amber-400">
                            {formatMoney(c.reviewCost)} en revisión
                          </span>
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
          <DataCard title="Productos con faltantes estimados (MXN)">
            <p className="mb-3 text-xs text-on-surface-variant">
              Diferencias ordinarias pendientes de conciliación. Los registros extraordinarios se muestran en el bloque de revisión.
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
          <DataCard title="Productos con mayor consumo POS valorizado">
            <p className="mb-3 text-xs text-on-surface-variant">
              Ventas POS netas de devoluciones, agrupadas por producto entre sucursales. Importes a costo de inventario, no a precio de venta.
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
                          {item.count} movimientos de venta{item.reversals > 0 ? ` · ${item.reversals} devoluciones` : ""}
                        </p>
                        {item.branches.length > 1 && (
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            {item.branches.map((row) => `${row.name}: ${formatQuantity(row.amount, item.product)}`).join(" · ")}
                          </p>
                        )}
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
        <DataCard title="Partidas con mayor faltante estimado">
          <p className="mb-3 text-xs text-on-surface-variant">
            Diferencias físicas sin alertas extraordinarias ni movimientos posteriores a la captura, ordenadas por costo estimado. Deben conciliarse.
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
          <DataCard title="Productos contados en cero">
            <p className="mb-3 text-xs text-on-surface-variant">
              Insumos con existencia teórica en sistema que salieron en 0 en el conteo físico.
            </p>
            <CountTable rows={absentRows} mode="missing" />
          </DataCard>

          <DataCard title="Desviaciones mayores al 10%">
            <p className="mb-3 text-xs text-on-surface-variant">
              Discrepancia porcentual mayor al 10%, excluyendo partidas pendientes de revisión. Este umbral es solo un filtro de análisis, no una tolerancia aprobada.
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
                {row.requiresReview && (
                  <span className="block text-xs font-semibold text-amber-400">
                    Saldo extraordinario: requiere revisión
                  </span>
                )}
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
