import { addDaysToDateOnly, businessDayStart, formatBusinessDateOnly, formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { allocatePayrollEntries, allocatePayrollEntry } from "./payrollAllocation";

export async function getBranchAccountingHistory(input: { branchId: string; from: string; to: string }) {
  const fromDate = parseDateOnly(input.from);
  const toDate = parseDateOnly(input.to);
  const endExclusive = businessDayStart(addDaysToDateOnly(input.to, 1));
  const startInstant = businessDayStart(input.from);

  const [payrollPeriods, cashCuts, cashOutflows, envelopes] = await Promise.all([
    prisma.payrollPeriod.findMany({
      // A day or month can intersect a payroll week whose Monday falls
      // before the selected range, so include the six preceding calendar days
      // and trim each snapshot below to the requested civil dates.
      where: { status: "PAGADA", weekStart: { gte: parseDateOnly(addDaysToDateOnly(input.from, -6)), lte: toDate } },
      select: {
        weekStart: true,
        entries: {
          where: { status: "PAGADA" },
          select: { totalPay: true, basePay: true, overtimePay: true, daysSnapshot: true, user: { select: { name: true } } },
        },
      },
      orderBy: { weekStart: "desc" },
    }),
    prisma.cashCut.findMany({
      where: {
        branchId: input.branchId,
        status: { in: ["CERRADO", "AUDITADO"] },
        archivedAt: null,
        date: { gte: fromDate, lte: toDate },
      },
      select: { id: true, code: true, date: true, totalSales: true, totalOutflows: true, netProfit: true, envelopeAmount: true, envelopeNumber: true },
      orderBy: { date: "desc" },
    }),
    prisma.cashOutflow.findMany({
      where: {
        occurredAt: { gte: startInstant, lt: endExclusive },
        cashCut: { branchId: input.branchId, status: { in: ["CERRADO", "AUDITADO"] }, archivedAt: null },
      },
      select: { id: true, concept: true, category: true, amount: true, occurredAt: true, cashCut: { select: { code: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.cashSafeEnvelope.findMany({
      where: { branchId: input.branchId, cutDate: { gte: fromDate, lte: toDate } },
      select: { id: true, code: true, cutDate: true, originalAmount: true, currentBalance: true, status: true, cashCut: { select: { code: true, envelopeNumber: true } } },
      orderBy: { cutDate: "desc" },
    }),
  ]);

  const payroll = payrollPeriods.map((period) => {
    const allocation = allocatePayrollEntries(period.entries, input.branchId);
    const employees = period.entries.map((entry) => {
      const detail = allocatePayrollEntry(entry, input.branchId);
      const days = detail.days.filter((day) => day.date >= input.from && day.date <= input.to);
      return { name: entry.user.name, amount: days.reduce((sum, day) => sum + day.amount, 0), days };
    }).filter((entry) => entry.amount > 0);
    return {
      weekStart: formatDateOnly(period.weekStart),
      amount: employees.reduce((sum, employee) => sum + employee.amount, 0),
      employeeCount: allocation.entriesWithBranchPay,
      unallocated: allocation.unallocated,
      employees,
    };
  });

  return {
    payroll,
    cashCuts: cashCuts.map((cut) => ({
      id: cut.id,
      code: cut.code,
      date: formatDateOnly(cut.date),
      sales: cut.totalSales ?? 0,
      outflows: cut.totalOutflows ?? 0,
      netProfit: cut.netProfit,
      envelopeAmount: cut.envelopeAmount,
      envelopeNumber: cut.envelopeNumber,
    })),
    cashOutflows: cashOutflows.map((outflow) => ({
      id: outflow.id,
      date: formatBusinessDateOnly(outflow.occurredAt),
      concept: outflow.concept,
      category: outflow.category,
      amount: outflow.amount,
      cashCutCode: outflow.cashCut.code,
    })),
    envelopes: envelopes.map((envelope) => ({
      id: envelope.id,
      code: envelope.code,
      date: formatDateOnly(envelope.cutDate),
      originalAmount: envelope.originalAmount,
      currentBalance: envelope.currentBalance,
      status: envelope.status,
      cashCutCode: envelope.cashCut.code,
      envelopeNumber: envelope.cashCut.envelopeNumber,
    })),
  };
}
