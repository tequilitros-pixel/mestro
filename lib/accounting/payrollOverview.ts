import { periodRange } from "@/lib/accounting";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { allocatePayrollEntries } from "./payrollAllocation";

type PayrollOverviewPeriod = {
  weekStart: Date;
  entries: Array<{
    totalPay: unknown;
    basePay: unknown;
    overtimePay: unknown;
    daysSnapshot: unknown;
  }>;
};

export type BranchPayrollOverview = {
  week: number;
  month: number;
  year: number;
  monthTrend: Array<{ key: string; label: string; amount: number }>;
};

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
    .format(parseDateOnly(`${key}-01`))
    .replace(".", "")
    .replace(/^./, (letter) => letter.toUpperCase());
}

/** Resume la nómina pagada de una sucursal para la semana, mes y año del ancla. */
export async function getBranchPayrollOverview(input: { branchId: string; anchor: string }): Promise<BranchPayrollOverview> {
  const weekRange = periodRange("week", input.anchor);
  const monthRange = periodRange("month", input.anchor);
  const yearRange = periodRange("year", input.anchor);
  const yearStart = parseDateOnly(yearRange.from);
  const yearEnd = parseDateOnly(yearRange.to);

  const periods = await prisma.payrollPeriod.findMany({
    where: { status: "PAGADA", weekStart: { gte: yearStart, lte: yearEnd } },
    select: {
      weekStart: true,
      entries: {
        where: { status: "PAGADA" },
        select: { totalPay: true, basePay: true, overtimePay: true, daysSnapshot: true },
      },
    },
    orderBy: { weekStart: "asc" },
  }) as PayrollOverviewPeriod[];

  const rows = periods.map((period) => ({
    weekStart: formatDateOnly(period.weekStart),
    amount: allocatePayrollEntries(period.entries, input.branchId).amount,
  }));
  const sumRange = (range: { from: string; to: string }) => rows
    .filter((row) => row.weekStart >= range.from && row.weekStart <= range.to)
    .reduce((sum, row) => sum + row.amount, 0);

  const monthAmounts = new Map<string, number>();
  for (let month = 1; month <= 12; month += 1) {
    const key = `${yearRange.from.slice(0, 4)}-${String(month).padStart(2, "0")}`;
    monthAmounts.set(key, 0);
  }
  for (const row of rows) {
    const key = row.weekStart.slice(0, 7);
    monthAmounts.set(key, (monthAmounts.get(key) ?? 0) + row.amount);
  }

  return {
    week: sumRange(weekRange),
    month: sumRange(monthRange),
    year: sumRange(yearRange),
    monthTrend: [...monthAmounts].map(([key, amount]) => ({ key, label: monthLabel(key), amount })),
  };
}
