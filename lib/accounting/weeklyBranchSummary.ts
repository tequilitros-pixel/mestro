import { Prisma } from "@prisma/client";
import { addDaysToDateOnly, businessDayStart, parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { allocatePayrollEntries } from "./payrollAllocation";

export type WeeklyBranchSummary = {
  sales: number;
  salesCutCount: number;
  payrollPaid: number;
  payrollEntries: number;
  payrollUnallocated: number;
  payrollStatus: "PAGADA" | "SIN_NOMINA_PAGADA";
  cashOutflows: number;
  cashOutflowCount: number;
  accountingPayments: number;
  accountingPaymentCount: number;
  totalExpenses: number;
  netResult: number;
};

/**
 * Resume una semana de una sucursal usando los registros que ya existen.
 * Las salidas de caja y los pagos administrativos se muestran por separado
 * para que el usuario pueda detectar una captura duplicada antes de corregirla.
 */
export async function getWeeklyBranchSummary(input: {
  branchId: string;
  from: string;
  to: string;
}): Promise<WeeklyBranchSummary> {
  const fromDate = parseDateOnly(input.from);
  const toDate = parseDateOnly(input.to);
  const endExclusive = businessDayStart(addDaysToDateOnly(input.to, 1));
  const startInstant = businessDayStart(input.from);

  const [sales, cashOutflows, accountingPayments, payrollPeriod] = await Promise.all([
    prisma.cashCut.aggregate({
      where: {
        branchId: input.branchId,
        status: "CERRADO",
        archivedAt: null,
        date: { gte: fromDate, lte: toDate },
      },
      _sum: { totalSales: true },
      _count: { _all: true },
    }),
    prisma.cashOutflow.aggregate({
      where: {
        occurredAt: { gte: startInstant, lt: endExclusive },
        cashCut: { branchId: input.branchId },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.accountingPayment.aggregate({
      where: {
        branchId: input.branchId,
        paymentDate: { gte: fromDate, lte: toDate },
        voidedAt: null,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payrollPeriod.findUnique({
      where: { weekStart: fromDate },
      select: {
        status: true,
        entries: {
          where: { status: "PAGADA" },
          select: {
            totalPay: true,
            basePay: true,
            overtimePay: true,
            daysSnapshot: true,
          },
        },
      },
    }),
  ]);

  const paidEntries = payrollPeriod?.status === "PAGADA" ? payrollPeriod.entries : [];
  const payrollAllocation = allocatePayrollEntries(paidEntries, input.branchId);
  const payrollPaid = payrollAllocation.amount;
  const payrollUnallocated = payrollAllocation.unallocated;

  const salesTotal = sales._sum.totalSales ?? 0;
  const cashOutflowTotal = cashOutflows._sum.amount ?? 0;
  const accountingPaymentTotal = accountingPayments._sum.amount ?? new Prisma.Decimal(0);
  const payrollStatus = payrollPeriod?.status === "PAGADA" ? "PAGADA" : "SIN_NOMINA_PAGADA";
  const totalExpenses = payrollPaid + cashOutflowTotal + Number(accountingPaymentTotal);

  return {
    sales: salesTotal,
    salesCutCount: sales._count._all,
    payrollPaid,
    payrollEntries: paidEntries.length,
    payrollUnallocated,
    payrollStatus,
    cashOutflows: cashOutflowTotal,
    cashOutflowCount: cashOutflows._count._all,
    accountingPayments: Number(accountingPaymentTotal),
    accountingPaymentCount: accountingPayments._count._all,
    totalExpenses,
    netResult: salesTotal - totalExpenses,
  };
}
