import {
  addDaysToDateOnly,
  businessDayStart,
  formatBusinessDateOnly,
  formatDateOnly,
  parseDateOnly,
} from "../dateOnly";
import { resolveBranchHourlyRate } from "../payroll/branchRates";
import {
  costPerInventoryBaseUnit,
  formatHumanQuantity,
  formatReadableMeasure,
} from "./inventoryCost";
export { formatHumanQuantity, formatReadableMeasure };
import { allocatePayrollEntry } from "./payrollAllocation";

async function getPrisma() {
  const mod = await import("../prisma");
  return mod.prisma;
}

export type CostAlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export type CostAlert = {
  code: string;
  category: "COGS" | "LABOR" | "PRIME_COST" | "RENT" | "OPERATING_MARGIN" | "DATA_INTEGRITY";
  severity: CostAlertSeverity;
  message: string;
  metricValue?: number;
  threshold?: number;
};

export type BranchFinancialMetrics = {
  branchId: string;
  branchName: string;
  sales: number;
  saleCount: number;
  cogs: number;
  cogsPercent: number;
  theoreticalCogs: number;
  theoreticalCogsPercent: number;
  wasteCost: number;
  costVariance: number;
  payroll: number;
  laborCost: number;
  laborCostPercent: number;
  laborHours: number;
  salesPerLaborHour: number;
  rentCost: number;
  rentPercent: number;
  hasRent: boolean;
  cashOutflows: number;
  accountingPayments: number;
  otherExpenses: number;
  operatingIncome: number;
  operatingMarginPercent: number;
  costAlerts: CostAlert[];
  inventory: {
    actualCost: number;
    actualCostKnown: boolean;
    theoreticalCost: number;
    theoreticalCostKnown: boolean;
    wasteCost: number;
    variance: number;
  };
  registeredExpenses: number;
  theoreticalExpenses: number;
  registeredResult: number;
  theoreticalResult: number;
  registeredResultComplete: boolean;
  theoreticalResultComplete: boolean;
};

export type CompanyFinancialSummary = {
  sales: number;
  saleCount: number;
  cogs: number;
  cogsPercent: number;
  theoreticalCogs: number;
  theoreticalCogsPercent: number;
  wasteCost: number;
  costVariance: number;
  payroll: number;
  laborCost: number;
  laborCostPercent: number;
  laborHours: number;
  salesPerLaborHour: number;
  rentCost: number;
  rentPercent: number;
  hasRent: boolean;
  cashOutflows: number;
  accountingPayments: number;
  otherExpenses: number;
  operatingIncome: number;
  operatingMarginPercent: number;
  costAlerts: CostAlert[];
};

export type MultiBranchFinancialOverview = {
  from: string;
  to: string;
  consolidated: CompanyFinancialSummary;
  branches: BranchFinancialMetrics[];
};

export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percent(numerator: number, denominator: number): number {
  if (denominator <= 0 || !Number.isFinite(denominator)) return 0;
  return money((numerator / denominator) * 100);
}

/**
 * Convierte el costo de una presentación a costo por unidad base (ml, g, unidad)
 * siempre que exista `inventoryBaseUnit` y `normalizedContentPerUnit > 0`, sin
 * importar si `unitStatus` es `RESOLVED` o no, evitando inflar dosis de coctelería o cocina.
 */
export function resolveIngredientBaseCost(product: {
  unitCost: unknown;
  inventoryBaseUnit?: unknown;
  normalizedContentPerUnit?: unknown;
}): number | null {
  return costPerInventoryBaseUnit(product);
}

/**
 * Calcula el costo de una dosis de ingrediente en una receta.
 */
export function calculateIngredientCost(ingredient: {
  quantity: unknown;
  unit?: unknown;
  unitStatus?: unknown;
  inventoryProduct: {
    unitCost: unknown;
    inventoryBaseUnit?: unknown;
    normalizedContentPerUnit?: unknown;
  };
}): { cost: number | null; unitCostPerBaseUnit: number | null; quantity: number } {
  const quantity = Math.abs(Number(ingredient.quantity) || 0);
  const costPerBase = resolveIngredientBaseCost(ingredient.inventoryProduct);

  if (costPerBase === null) {
    return { cost: null, unitCostPerBaseUnit: null, quantity };
  }

  return {
    cost: money(quantity * costPerBase),
    unitCostPerBaseUnit: costPerBase,
    quantity,
  };
}

/**
 * Identifica si un movimiento de inventario corresponde a merma, daño,
 * uso interno o discrepancia de auditoría.
 */
export function isWasteMovement(movement: {
  movementType?: string | null;
  reasonCode?: string | null;
}): boolean {
  const reason = (movement.reasonCode ?? "").toUpperCase().trim();
  const type = (movement.movementType ?? "").toUpperCase().trim();

  const wasteKeywords = [
    "WASTE",
    "AUDIT_DISCREPANCY",
    "INTERNAL_USE",
    "DAMAGED",
    "MERMA",
    "DISCREPANCIA",
    "CONSUMO_INTERNO",
    "DANADO",
    "DAÑADO",
    "DISCARD",
    "DESECHO",
    "CADUCADO",
    "EXPIRED",
    "ROTURA",
  ];

  if (wasteKeywords.some((w) => reason === w || reason.includes(w))) {
    return true;
  }

  if (type === "ADJUSTMENT_OUT") {
    return true;
  }

  return false;
}

/**
 * Identifica si un egreso (pago contable o salida de caja) corresponde a renta o arrendamiento.
 */
export function isRentExpense(item: {
  categoryCode?: string | null;
  categoryName?: string | null;
  concept?: string | null;
}): boolean {
  const code = (item.categoryCode ?? "").toUpperCase().trim();
  if (code === "CONT_RENTA" || code === "PAGO_RENTA" || code === "RENTA" || code === "ARRENDAMIENTO") {
    return true;
  }

  const text = `${item.categoryName ?? ""} ${item.concept ?? ""}`.toLowerCase();
  return /\b(renta|arrendamiento)\b/i.test(text);
}

/**
 * Genera alertas de sobrecosto automáticas basadas en estándares operativos de la industria.
 */
export function generateCostAlerts(metrics: {
  sales: number;
  cogsPercent: number;
  wasteCost: number;
  costVariance: number;
  laborCostPercent: number;
  rentCost: number;
  rentPercent: number;
  operatingIncome: number;
  operatingMarginPercent: number;
  cogsKnown: boolean;
  periodDays?: number;
}): CostAlert[] {
  const alerts: CostAlert[] = [];

  if (metrics.sales > 0) {
    if (metrics.cogsPercent > 42) {
      alerts.push({
        code: "COGS_CRITICAL",
        category: "COGS",
        severity: "CRITICAL",
        message: `Costo de insumos crítico: ${metrics.cogsPercent.toFixed(1)}% de las ventas (umbral máx: 42%).`,
        metricValue: metrics.cogsPercent,
        threshold: 42,
      });
    } else if (metrics.cogsPercent > 35) {
      alerts.push({
        code: "COGS_HIGH",
        category: "COGS",
        severity: "WARNING",
        message: `Costo de insumos elevado: ${metrics.cogsPercent.toFixed(1)}% de las ventas (umbral rec: 35%).`,
        metricValue: metrics.cogsPercent,
        threshold: 35,
      });
    }

    if (metrics.wasteCost > 0) {
      const wastePercent = percent(metrics.wasteCost, metrics.sales);
      if (wastePercent > 5) {
        alerts.push({
          code: "WASTE_CRITICAL",
          category: "COGS",
          severity: "CRITICAL",
          message: `Merma registrada muy alta: $${metrics.wasteCost.toFixed(2)} (${wastePercent.toFixed(1)}% de ventas).`,
          metricValue: metrics.wasteCost,
          threshold: 5,
        });
      } else if (wastePercent > 2.5) {
        alerts.push({
          code: "WASTE_HIGH",
          category: "COGS",
          severity: "WARNING",
          message: `Merma registrada sobre el estándar: $${metrics.wasteCost.toFixed(2)} (${wastePercent.toFixed(1)}% de ventas).`,
          metricValue: metrics.wasteCost,
          threshold: 2.5,
        });
      }
    }

    if (metrics.costVariance > 0) {
      const variancePercent = percent(metrics.costVariance, metrics.sales);
      if (variancePercent > 5) {
        alerts.push({
          code: "VARIANCE_HIGH",
          category: "COGS",
          severity: "WARNING",
          message: `Fuga o variación no justificada vs recetas: $${metrics.costVariance.toFixed(2)} (${variancePercent.toFixed(1)}% de ventas).`,
          metricValue: metrics.costVariance,
          threshold: 5,
        });
      }
    }

    if (metrics.laborCostPercent > 40) {
      alerts.push({
        code: "LABOR_CRITICAL",
        category: "LABOR",
        severity: "CRITICAL",
        message: `Costo de nómina crítico: ${metrics.laborCostPercent.toFixed(1)}% de las ventas (umbral máx: 40%).`,
        metricValue: metrics.laborCostPercent,
        threshold: 40,
      });
    } else if (metrics.laborCostPercent > 32) {
      alerts.push({
        code: "LABOR_HIGH",
        category: "LABOR",
        severity: "WARNING",
        message: `Costo de nómina elevado: ${metrics.laborCostPercent.toFixed(1)}% de las ventas (umbral rec: 32%).`,
        metricValue: metrics.laborCostPercent,
        threshold: 32,
      });
    }

    const primeCost = metrics.cogsPercent + metrics.laborCostPercent;
    if (primeCost > 72) {
      alerts.push({
        code: "PRIME_COST_CRITICAL",
        category: "PRIME_COST",
        severity: "CRITICAL",
        message: `Costo Primo (COGS + Nómina) crítico: ${primeCost.toFixed(1)}% de las ventas (umbral máx: 72%).`,
        metricValue: primeCost,
        threshold: 72,
      });
    } else if (primeCost > 65) {
      alerts.push({
        code: "PRIME_COST_HIGH",
        category: "PRIME_COST",
        severity: "WARNING",
        message: `Costo Primo (COGS + Nómina) elevado: ${primeCost.toFixed(1)}% de las ventas (umbral rec: 65%).`,
        metricValue: primeCost,
        threshold: 65,
      });
    }

    if (metrics.rentPercent > 18) {
      alerts.push({
        code: "RENT_CRITICAL",
        category: "RENT",
        severity: "CRITICAL",
        message: `Carga de renta crítica: ${metrics.rentPercent.toFixed(1)}% de las ventas (umbral máx: 18%).`,
        metricValue: metrics.rentPercent,
        threshold: 18,
      });
    } else if (metrics.rentPercent > 12) {
      alerts.push({
        code: "RENT_HIGH",
        category: "RENT",
        severity: "WARNING",
        message: `Carga de renta elevada: ${metrics.rentPercent.toFixed(1)}% de las ventas (umbral rec: 12%).`,
        metricValue: metrics.rentPercent,
        threshold: 12,
      });
    }

    if (metrics.operatingIncome < 0) {
      alerts.push({
        code: "OPERATING_LOSS",
        category: "OPERATING_MARGIN",
        severity: "CRITICAL",
        message: `Operación con pérdida: -$${Math.abs(metrics.operatingIncome).toFixed(2)} (${metrics.operatingMarginPercent.toFixed(1)}% de margen).`,
        metricValue: metrics.operatingIncome,
        threshold: 0,
      });
    } else if (metrics.operatingMarginPercent < 8) {
      alerts.push({
        code: "OPERATING_MARGIN_LOW",
        category: "OPERATING_MARGIN",
        severity: "WARNING",
        message: `Margen operativo bajo: ${metrics.operatingMarginPercent.toFixed(1)}% (objetivo rec: > 10%).`,
        metricValue: metrics.operatingMarginPercent,
        threshold: 8,
      });
    }
  }

  if (metrics.periodDays && metrics.periodDays >= 25 && metrics.rentCost === 0) {
    alerts.push({
      code: "RENT_MISSING",
      category: "RENT",
      severity: "INFO",
      message: "No se registró pago de renta en este periodo mensual/extenso.",
    });
  }

  if (!metrics.cogsKnown) {
    alerts.push({
      code: "PENDING_UNIT_COSTS",
      category: "DATA_INTEGRITY",
      severity: "WARNING",
      message: "Uno o más insumos consumidos no tienen costo unitario; la valuación de inventario es parcial.",
    });
  }

  return alerts;
}

export type ComputeBranchFinancialInput = {
  branchId: string;
  branchName: string;
  sales: number;
  saleCount: number;
  cogs: number;
  cogsKnown: boolean;
  theoreticalCogs: number;
  theoreticalCogsKnown: boolean;
  wasteCost: number;
  closedLaborCost: number;
  accruedLaborCost: number;
  closedLaborHours: number;
  accruedLaborHours: number;
  rentCost: number;
  cashOutflows: number;
  accountingPayments: number;
  otherExpenses: number;
  periodDays?: number;
};

export function computeBranchFinancialMetrics(input: ComputeBranchFinancialInput): BranchFinancialMetrics {
  const sales = money(input.sales);
  const cogs = money(input.cogs);
  const theoreticalCogs = money(input.theoreticalCogs);
  const wasteCost = money(input.wasteCost);
  const costVariance = money(cogs - theoreticalCogs);

  const laborCost = money(input.closedLaborCost + input.accruedLaborCost);
  const laborHours = money(input.closedLaborHours + input.accruedLaborHours);
  const rentCost = money(input.rentCost);
  const cashOutflows = money(input.cashOutflows);
  const accountingPayments = money(input.accountingPayments);
  const otherExpenses = money(input.otherExpenses);

  const cogsPercent = percent(cogs, sales);
  const theoreticalCogsPercent = percent(theoreticalCogs, sales);
  const laborCostPercent = percent(laborCost, sales);
  const rentPercent = percent(rentCost, sales);
  const salesPerLaborHour = laborHours > 0 ? money(sales / laborHours) : 0;
  const hasRent = rentCost > 0;

  const nonInventoryExpenses = money(laborCost + rentCost + otherExpenses);
  const registeredExpenses = money(cogs + nonInventoryExpenses);
  const theoreticalExpenses = money(theoreticalCogs + nonInventoryExpenses);

  const operatingIncome = money(sales - registeredExpenses);
  const operatingMarginPercent = percent(operatingIncome, sales);
  const theoreticalResult = money(sales - theoreticalExpenses);

  const costAlerts = generateCostAlerts({
    sales,
    cogsPercent,
    wasteCost,
    costVariance,
    laborCostPercent,
    rentCost,
    rentPercent,
    operatingIncome,
    operatingMarginPercent,
    cogsKnown: input.cogsKnown,
    periodDays: input.periodDays,
  });

  return {
    branchId: input.branchId,
    branchName: input.branchName,
    sales,
    saleCount: input.saleCount,
    cogs,
    cogsPercent,
    theoreticalCogs,
    theoreticalCogsPercent,
    wasteCost,
    costVariance,
    payroll: laborCost,
    laborCost,
    laborCostPercent,
    laborHours,
    salesPerLaborHour,
    rentCost,
    rentPercent,
    hasRent,
    cashOutflows,
    accountingPayments,
    otherExpenses,
    operatingIncome,
    operatingMarginPercent,
    costAlerts,
    inventory: {
      actualCost: cogs,
      actualCostKnown: input.cogsKnown,
      theoreticalCost: theoreticalCogs,
      theoreticalCostKnown: input.theoreticalCogsKnown,
      wasteCost,
      variance: costVariance,
    },
    registeredExpenses,
    theoreticalExpenses,
    registeredResult: operatingIncome,
    theoreticalResult,
    registeredResultComplete: input.cogsKnown,
    theoreticalResultComplete: input.theoreticalCogsKnown,
  };
}

export function computeCompanyConsolidatedMetrics(
  branches: BranchFinancialMetrics[],
  periodDays?: number,
): CompanyFinancialSummary {
  const sales = money(branches.reduce((sum, b) => sum + b.sales, 0));
  const saleCount = branches.reduce((sum, b) => sum + b.saleCount, 0);
  const cogs = money(branches.reduce((sum, b) => sum + b.cogs, 0));
  const theoreticalCogs = money(branches.reduce((sum, b) => sum + b.theoreticalCogs, 0));
  const wasteCost = money(branches.reduce((sum, b) => sum + b.wasteCost, 0));
  const costVariance = money(cogs - theoreticalCogs);
  const laborCost = money(branches.reduce((sum, b) => sum + b.laborCost, 0));
  const laborHours = money(branches.reduce((sum, b) => sum + b.laborHours, 0));
  const rentCost = money(branches.reduce((sum, b) => sum + b.rentCost, 0));
  const cashOutflows = money(branches.reduce((sum, b) => sum + b.cashOutflows, 0));
  const accountingPayments = money(branches.reduce((sum, b) => sum + b.accountingPayments, 0));
  const otherExpenses = money(branches.reduce((sum, b) => sum + b.otherExpenses, 0));

  const cogsPercent = percent(cogs, sales);
  const theoreticalCogsPercent = percent(theoreticalCogs, sales);
  const laborCostPercent = percent(laborCost, sales);
  const rentPercent = percent(rentCost, sales);
  const salesPerLaborHour = laborHours > 0 ? money(sales / laborHours) : 0;
  const hasRent = rentCost > 0;

  const totalExpenses = money(cogs + laborCost + rentCost + otherExpenses);
  const operatingIncome = money(sales - totalExpenses);
  const operatingMarginPercent = percent(operatingIncome, sales);

  const allCogsKnown = branches.every((b) => b.inventory.actualCostKnown);
  const costAlerts = generateCostAlerts({
    sales,
    cogsPercent,
    wasteCost,
    costVariance,
    laborCostPercent,
    rentCost,
    rentPercent,
    operatingIncome,
    operatingMarginPercent,
    cogsKnown: allCogsKnown,
    periodDays,
  });

  return {
    sales,
    saleCount,
    cogs,
    cogsPercent,
    theoreticalCogs,
    theoreticalCogsPercent,
    wasteCost,
    costVariance,
    payroll: laborCost,
    laborCost,
    laborCostPercent,
    laborHours,
    salesPerLaborHour,
    rentCost,
    rentPercent,
    hasRent,
    cashOutflows,
    accountingPayments,
    otherExpenses,
    operatingIncome,
    operatingMarginPercent,
    costAlerts,
  };
}

type OvertimeSlice = {
  userId: string;
  branchId: string;
  overtimeHours: unknown;
  amount: unknown;
  status: string;
};

async function fetchOvertimeSafely(
  prismaClient: unknown,
  start: Date,
  end: Date,
): Promise<{ available: boolean; records: OvertimeSlice[] }> {
  const model = (prismaClient as { overtimeRecord?: { findMany: (args: unknown) => Promise<OvertimeSlice[]> } })
    ?.overtimeRecord;

  if (!model) return { available: false, records: [] };

  try {
    const records = await model.findMany({
      where: { weekStart: { gte: start, lt: end } },
      select: {
        userId: true,
        branchId: true,
        overtimeHours: true,
        amount: true,
        status: true,
      },
    });
    return { available: true, records };
  } catch {
    return { available: false, records: [] };
  }
}

function workedMinutes(entry: { clockIn?: unknown; clockOut?: unknown }): number {
  if (typeof entry.clockIn !== "string" || typeof entry.clockOut !== "string") return 0;
  const start = Date.parse(entry.clockIn);
  const end = Date.parse(entry.clockOut);
  const minutes = (end - start) / 60_000;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/**
 * Consulta y calcula el resultado financiero y P&L consolidado para múltiples sucursales
 * unificando ventas de POSpress, recetas, movimientos de inventario, mermas, nómina
 * cerrada y devengada, y egresos (pagos contables + caja chica) con desglose de renta.
 */
export async function getMultiBranchFinancialOverview(input: {
  branchIds: string[];
  from: string;
  to: string;
}): Promise<MultiBranchFinancialOverview> {
  const fromDate = parseDateOnly(input.from);
  const toDate = parseDateOnly(input.to);
  const startInstant = businessDayStart(input.from);
  const endInstant = businessDayStart(addDaysToDateOnly(input.to, 1));
  const periodDays = Math.max(
    1,
    Math.round((businessDayStart(addDaysToDateOnly(input.to, 1)).getTime() - businessDayStart(input.from).getTime()) / 86400000),
  );

  const prisma = await getPrisma();

  const [
    branches,
    sales,
    movements,
    legacyEntries,
    balances,
    payrollPeriods,
    timeClockEntries,
    salaryRates,
    overtime,
    cashOutflows,
    accountingPayments,
  ] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: input.branchIds } },
      select: { id: true, name: true },
    }),
    prisma.posSale.findMany({
      where: {
        branchId: { in: input.branchIds },
        status: "COMPLETADA",
        createdAt: { gte: startInstant, lt: endInstant },
      },
      select: {
        branchId: true,
        total: true,
        createdAt: true,
        items: {
          where: { isCustom: false },
          select: {
            quantity: true,
            variant: {
              select: {
                ingredients: {
                  select: {
                    quantity: true,
                    unit: true,
                    unitStatus: true,
                    inventoryProduct: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        unitCost: true,
                        inventoryBaseUnit: true,
                        normalizedContentPerUnit: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        branchId: { in: input.branchIds },
        createdAt: { gte: startInstant, lt: endInstant },
        OR: [
          { movementType: { in: ["SALE_CONSUMPTION", "SALE_REVERSAL", "ADJUSTMENT_OUT", "COUNT_CORRECTION"] } },
          { reasonCode: { in: ["WASTE", "AUDIT_DISCREPANCY", "INTERNAL_USE", "DAMAGED"] } },
        ],
      },
      select: {
        branchId: true,
        inventoryProductId: true,
        movementType: true,
        quantityDelta: true,
        reasonCode: true,
        inventoryProduct: {
          select: {
            code: true,
            name: true,
            unitCost: true,
            inventoryBaseUnit: true,
            normalizedContentPerUnit: true,
          },
        },
      },
    }),
    prisma.inventoryEntry.findMany({
      where: {
        branchId: { in: input.branchIds },
        entryDate: { gte: startInstant, lt: endInstant },
        type: { in: ["VENTA_POS", "DEVOLUCION_POS", "AJUSTE"] },
      },
      select: {
        branchId: true,
        productId: true,
        type: true,
        quantity: true,
        unitCost: true,
        product: { select: { unitCost: true } },
      },
    }),
    prisma.inventoryBalance.findMany({
      where: { branchId: { in: input.branchIds } },
      select: { branchId: true, inventoryProductId: true },
    }),
    prisma.payrollPeriod.findMany({
      where: {
        status: { in: ["PAGADA", "APROBADA"] },
        weekStart: {
          gte: parseDateOnly(addDaysToDateOnly(input.from, -6)),
          lte: toDate,
        },
      },
      select: {
        weekStart: true,
        weekEnd: true,
        status: true,
        entries: {
          where: { status: { in: ["PAGADA", "APROBADA"] } },
          select: {
            totalPay: true,
            basePay: true,
            overtimePay: true,
            daysSnapshot: true,
          },
        },
      },
    }),
    prisma.timeClockEntry.findMany({
      where: {
        branchId: { in: input.branchIds },
        clockIn: { gte: startInstant, lt: endInstant },
        clockOut: { not: null },
      },
      select: {
        userId: true,
        branchId: true,
        clockIn: true,
        clockOut: true,
        user: { select: { id: true, hourlyRate: true } },
      },
    }),
    prisma.salaryRate.findMany({
      where: { scheme: "HORA" },
      select: { userId: true, branchId: true, amount: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    fetchOvertimeSafely(prisma, fromDate, parseDateOnly(addDaysToDateOnly(input.to, 1))),
    prisma.cashOutflow.findMany({
      where: {
        occurredAt: { gte: startInstant, lt: endInstant },
        cashCut: {
          branchId: { in: input.branchIds },
          status: { in: ["CERRADO", "AUDITADO"] },
          archivedAt: null,
        },
      },
      select: {
        amount: true,
        concept: true,
        category: true,
        categoryNameSnapshot: true,
        categoryRef: { select: { code: true, name: true } },
        cashCut: { select: { branchId: true } },
      },
    }),
    prisma.accountingPayment.findMany({
      where: {
        branchId: { in: input.branchIds },
        paymentDate: { gte: fromDate, lte: toDate },
        voidedAt: null,
      },
      select: {
        branchId: true,
        amount: true,
        concept: true,
        categoryNameSnapshot: true,
        category: { select: { code: true, name: true } },
      },
    }),
  ]);

  const ratesByUser = new Map<string, typeof salaryRates>();
  for (const rate of salaryRates) {
    const list = ratesByUser.get(rate.userId) ?? [];
    list.push(rate);
    ratesByUser.set(rate.userId, list);
  }

  const v2ProductByBranch = new Map<string, Set<string>>();
  for (const b of balances) {
    const set = v2ProductByBranch.get(b.branchId) ?? new Set();
    set.add(b.inventoryProductId);
    v2ProductByBranch.set(b.branchId, set);
  }

  const branchMetricsList: BranchFinancialMetrics[] = branches.map((branch) => {
    const branchSales = sales.filter((s) => s.branchId === branch.id);
    const saleTotal = branchSales.reduce((sum, s) => sum + s.total, 0);
    const saleCount = branchSales.length;

    // Costo teórico de recetas para las ventas de la sucursal
    let theoreticalCogs = 0;
    let theoreticalCogsKnown = true;

    for (const sale of branchSales) {
      for (const item of sale.items) {
        if (!item.variant?.ingredients) continue;
        for (const ingredient of item.variant.ingredients) {
          const costInfo = calculateIngredientCost(ingredient);
          if (costInfo.cost === null) {
            theoreticalCogsKnown = false;
          } else {
            theoreticalCogs += costInfo.cost * item.quantity;
          }
        }
      }
    }

    // Costo real y merma en InventoryMovement
    const branchMovements = movements.filter((m) => m.branchId === branch.id);
    let saleMovementCost = 0;
    let wasteCost = 0;
    let cogsKnown = true;

    for (const movement of branchMovements) {
      const unitCost = costPerInventoryBaseUnit(movement.inventoryProduct);
      const qty = Math.abs(Number(movement.quantityDelta));

      if (unitCost === null && qty > 0) {
        cogsKnown = false;
      }

      const cost = (unitCost ?? 0) * qty;

      if (isWasteMovement(movement)) {
        wasteCost += cost;
      } else if (movement.movementType === "SALE_REVERSAL" || Number(movement.quantityDelta) > 0) {
        saleMovementCost -= cost;
      } else {
        saleMovementCost += cost;
      }
    }

    // Compatibilidad con InventoryEntry legacy para productos que aún no migran a V2
    const v2Ids = v2ProductByBranch.get(branch.id) ?? new Set();
    const branchLegacyEntries = legacyEntries.filter(
      (e) => e.branchId === branch.id && !v2Ids.has(e.productId),
    );

    for (const entry of branchLegacyEntries) {
      const rawCost = entry.unitCost !== null ? Number(entry.unitCost) : (entry.product.unitCost !== null ? Number(entry.product.unitCost) : null);
      const qty = Math.abs(Number(entry.quantity));

      if (rawCost === null && qty > 0) {
        cogsKnown = false;
      }

      const cost = (rawCost ?? 0) * qty;

      if (entry.type === "AJUSTE" && Number(entry.quantity) < 0) {
        wasteCost += cost;
      } else if (entry.type === "DEVOLUCION_POS" || Number(entry.quantity) > 0) {
        saleMovementCost -= cost;
      } else {
        saleMovementCost += cost;
      }
    }

    const totalCogs = Math.max(0, saleMovementCost + wasteCost);

    // Nómina: periodos PAGADA y APROBADA
    let closedLaborCost = 0;
    let closedLaborHours = 0;
    const coveredDates = new Set<string>();

    for (const period of payrollPeriods) {
      for (const entry of period.entries) {
        const allocation = allocatePayrollEntry(entry, branch.id);
        for (const day of allocation.days) {
          if (day.date >= input.from && day.date <= input.to) {
            closedLaborCost += day.amount;
            coveredDates.add(day.date);
          }
        }

        // Extraer horas de los turnos asignados a esta sucursal dentro del snapshot
        if (Array.isArray(entry.daysSnapshot)) {
          for (const day of entry.daysSnapshot as Array<{ date?: unknown; entries?: unknown }>) {
            const dateStr = typeof day.date === "string" ? day.date : "";
            if (dateStr >= input.from && dateStr <= input.to && Array.isArray(day.entries)) {
              for (const shift of day.entries as Array<{ branchId?: unknown; clockIn?: unknown; clockOut?: unknown }>) {
                if (shift.branchId === branch.id) {
                  closedLaborHours += workedMinutes(shift) / 60;
                }
              }
            }
          }
        }
      }
    }

    // Nómina devengada: TimeClockEntry en días/semanas no cubiertos por periodos cerrados
    let accruedLaborCost = 0;
    let accruedLaborHours = 0;

    const branchClockEntries = timeClockEntries.filter((e) => e.branchId === branch.id);
    for (const entry of branchClockEntries) {
      if (!entry.clockOut) continue;
      const dateStr = formatBusinessDateOnly(entry.clockIn);
      // Si la fecha ya quedó pagada o aprobada en un PayrollPeriod, no la duplicamos
      if (coveredDates.has(dateStr)) continue;

      const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      if (!(hours > 0)) continue;

      const userRates = (ratesByUser.get(entry.userId) ?? []).map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));

      const generalRate = entry.user.hourlyRate !== null ? Number(entry.user.hourlyRate) : null;
      const rate = resolveBranchHourlyRate(userRates, branch.id, entry.clockIn, generalRate);

      accruedLaborHours += hours;
      if (rate !== null) {
        accruedLaborCost += hours * rate;
      }
    }

    // Tiempo extra aprobado en semanas no cerradas
    for (const record of overtime.records) {
      if (record.branchId !== branch.id || record.status !== "APROBADO") continue;
      const recWeek = formatDateOnly(startInstant);
      if (!coveredDates.has(recWeek)) {
        accruedLaborCost += Number(record.amount) || 0;
        accruedLaborHours += Number(record.overtimeHours) || 0;
      }
    }

    // Egresos unificados: Pagos contables + Caja chica
    const branchOutflows = cashOutflows.filter((o) => o.cashCut?.branchId === branch.id);
    const branchPayments = accountingPayments.filter((p) => p.branchId === branch.id);

    let rentCost = 0;
    let otherExpenses = 0;
    let totalCashOutflows = 0;
    let totalAccountingPayments = 0;

    for (const outflow of branchOutflows) {
      const amount = Number(outflow.amount) || 0;
      totalCashOutflows += amount;
      const isRent = isRentExpense({
        categoryCode: outflow.categoryRef?.code ?? null,
        categoryName: outflow.categoryNameSnapshot ?? outflow.categoryRef?.name ?? outflow.category,
        concept: outflow.concept,
      });

      if (isRent) {
        rentCost += amount;
      } else {
        otherExpenses += amount;
      }
    }

    for (const payment of branchPayments) {
      const amount = Number(payment.amount) || 0;
      totalAccountingPayments += amount;
      const isRent = isRentExpense({
        categoryCode: payment.category?.code ?? null,
        categoryName: payment.categoryNameSnapshot ?? payment.category?.name ?? null,
        concept: payment.concept,
      });

      if (isRent) {
        rentCost += amount;
      } else {
        otherExpenses += amount;
      }
    }

    return computeBranchFinancialMetrics({
      branchId: branch.id,
      branchName: branch.name,
      sales: saleTotal,
      saleCount,
      cogs: totalCogs,
      cogsKnown,
      theoreticalCogs,
      theoreticalCogsKnown,
      wasteCost,
      closedLaborCost,
      accruedLaborCost,
      closedLaborHours,
      accruedLaborHours,
      rentCost,
      cashOutflows: totalCashOutflows,
      accountingPayments: totalAccountingPayments,
      otherExpenses,
      periodDays,
    });
  });

  const consolidated = computeCompanyConsolidatedMetrics(branchMetricsList, periodDays);

  return {
    from: input.from,
    to: input.to,
    consolidated,
    branches: branchMetricsList,
  };
}

/**
 * Obtiene el resumen financiero y P&L para una sucursal individual.
 * Es compatible con el contrato de BranchFinancialSummary.
 */
export async function getBranchFinancialOverview(input: {
  branchId: string;
  from: string;
  to: string;
}): Promise<BranchFinancialMetrics> {
  const result = await getMultiBranchFinancialOverview({
    branchIds: [input.branchId],
    from: input.from,
    to: input.to,
  });

  if (result.branches.length > 0) {
    return result.branches[0];
  }

  return computeBranchFinancialMetrics({
    branchId: input.branchId,
    branchName: "Sucursal",
    sales: 0,
    saleCount: 0,
    cogs: 0,
    cogsKnown: true,
    theoreticalCogs: 0,
    theoreticalCogsKnown: true,
    wasteCost: 0,
    closedLaborCost: 0,
    accruedLaborCost: 0,
    closedLaborHours: 0,
    accruedLaborHours: 0,
    rentCost: 0,
    cashOutflows: 0,
    accountingPayments: 0,
    otherExpenses: 0,
  });
}
