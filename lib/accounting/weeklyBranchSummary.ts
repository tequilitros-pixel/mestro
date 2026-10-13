import { Prisma } from "@prisma/client";
import { addDaysToDateOnly, businessDayStart, parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";

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

type SnapshotEntry = {
  branchId?: unknown;
  pay?: unknown;
};

type SnapshotDay = {
  entries?: unknown;
};

function numberValue(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

function snapshotEntries(value: unknown): SnapshotEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SnapshotEntry => Boolean(entry) && typeof entry === "object");
}

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

  let payrollPaid = 0;
  let payrollUnallocated = 0;

  const paidEntries = payrollPeriod?.status === "PAGADA" ? payrollPeriod.entries : [];

  for (const entry of paidEntries) {
    const totalPay = numberValue(entry.totalPay);
    const basePay = numberValue(entry.basePay) + numberValue(entry.overtimePay);
    const byBranch = new Map<string, number>();
    let hasAnyBranchPay = false;

    for (const day of Array.isArray(entry.daysSnapshot) ? entry.daysSnapshot as SnapshotDay[] : []) {
      for (const item of snapshotEntries(day?.entries)) {
        const amount = numberValue(item.pay);
        if (item.branchId && amount > 0) hasAnyBranchPay = true;
        if (item.branchId !== input.branchId) continue;
        byBranch.set(input.branchId, (byBranch.get(input.branchId) ?? 0) + amount);
      }
    }

    const branchBase = byBranch.get(input.branchId) ?? 0;
    if (branchBase <= 0) {
      // Un empleado que trabajó otra sucursal no es un importe pendiente
      // de Canoas. Solo marcamos como no asignable lo que no trae sucursal.
      if (!hasAnyBranchPay) payrollUnallocated += totalPay;
      continue;
    }

    // Ajustes de la persona (bonos/deducciones) se asignan a la sucursal
    // según la proporción de horas pagadas que aparece en el snapshot.
    const adjustment = totalPay - basePay;
    const allocation = branchBase + (basePay > 0 ? adjustment * (branchBase / basePay) : 0);
    payrollPaid += Math.max(0, allocation);
  }

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
