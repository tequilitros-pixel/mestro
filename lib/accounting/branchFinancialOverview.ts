import { addDaysToDateOnly, businessDayStart, parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { getBranchInventoryOverview } from "./branchInventoryOverview";
import { getBranchSalesOverview } from "./branchSalesOverview";
import { allocatePayrollEntry } from "./payrollAllocation";
import { summarizeBranchFinancials, type BranchFinancialSummary } from "./branchFinancialSummary";

/** Obtiene el resultado operativo por sucursal a partir de registros existentes. */
export async function getBranchFinancialOverview(input: {
  branchId: string;
  from: string;
  to: string;
}): Promise<BranchFinancialSummary> {
  const fromDate = parseDateOnly(input.from);
  const toDate = parseDateOnly(input.to);
  const start = businessDayStart(input.from);
  const end = businessDayStart(addDaysToDateOnly(input.to, 1));

  const [sales, inventory, payrollPeriods, cashOutflows, accountingPayments] = await Promise.all([
    getBranchSalesOverview(input),
    getBranchInventoryOverview(input),
    prisma.payrollPeriod.findMany({
      // Un periodo consultado puede iniciar a mitad de una semana de nómina.
      where: { status: "PAGADA", weekStart: { gte: parseDateOnly(addDaysToDateOnly(input.from, -6)), lte: toDate } },
      select: {
        entries: {
          where: { status: "PAGADA" },
          select: { totalPay: true, basePay: true, overtimePay: true, daysSnapshot: true },
        },
      },
    }),
    prisma.cashOutflow.aggregate({
      where: {
        occurredAt: { gte: start, lt: end },
        cashCut: { branchId: input.branchId, status: { in: ["CERRADO", "AUDITADO"] }, archivedAt: null },
      },
      _sum: { amount: true },
    }),
    prisma.accountingPayment.aggregate({
      where: { branchId: input.branchId, paymentDate: { gte: fromDate, lte: toDate }, voidedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const payroll = payrollPeriods.reduce((total, period) => total + period.entries.reduce((periodTotal, entry) => {
    const amount = allocatePayrollEntry(entry, input.branchId).days
      .filter((day) => day.date >= input.from && day.date <= input.to)
      .reduce((sum, day) => sum + day.amount, 0);
    return periodTotal + amount;
  }, 0), 0);

  return summarizeBranchFinancials({
    sales: sales.total,
    saleCount: sales.saleCount,
    payroll,
    cashOutflows: cashOutflows._sum.amount ?? 0,
    accountingPayments: Number(accountingPayments._sum.amount ?? 0),
    inventoryActualCost: inventory.actual.cost,
    inventoryActualCostKnown: inventory.actual.costKnown,
    inventoryTheoreticalCost: inventory.theoretical.cost,
    inventoryTheoreticalCostKnown: inventory.theoretical.costKnown,
  });
}
