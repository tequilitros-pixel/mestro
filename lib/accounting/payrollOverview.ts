import { periodRange } from "@/lib/accounting";
import { addDaysToDateOnly, businessDayStart, formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import { computeHourlyPay } from "@/lib/payroll/legacyRules";
import { resolveBranchHourlyRate, type HourlyRateRow } from "@/lib/payroll/branchRates";
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

export type PayrollTrendPoint = {
  key: string;
  label: string;
  paid: number;
  budget: number;
};

export type BranchPayrollOverview = {
  week: number;
  month: number;
  year: number;
  budgetWeek: number;
  budgetMonth: number;
  budgetYear: number;
  weekTrend: PayrollTrendPoint[];
  monthTrend: PayrollTrendPoint[];
};

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
    .format(parseDateOnly(`${key}-01`))
    .replace(".", "")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function shiftHours(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  let hours = (endHour + endMinute / 60) - (startHour + startMinute / 60);
  if (hours <= 0) hours += 24;
  return hours;
}

function addAmount(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/** Resume la nómina pagada y el costo teórico publicado del calendario de una sucursal. */
export async function getBranchPayrollOverview(input: { branchId: string; anchor: string }): Promise<BranchPayrollOverview> {
  const weekRange = periodRange("week", input.anchor);
  const monthRange = periodRange("month", input.anchor);
  const yearRange = periodRange("year", input.anchor);
  const yearStart = parseDateOnly(yearRange.from);
  const yearEndExclusive = businessDayStart(addDaysToDateOnly(yearRange.to, 1));

  const [periods, scheduledShifts] = await Promise.all([
    prisma.payrollPeriod.findMany({
      where: { status: "PAGADA", weekStart: { gte: yearStart, lt: yearEndExclusive } },
      select: {
        weekStart: true,
        entries: {
          where: { status: "PAGADA" },
          select: { totalPay: true, basePay: true, overtimePay: true, daysSnapshot: true },
        },
      },
      orderBy: { weekStart: "asc" },
    }) as Promise<PayrollOverviewPeriod[]>,
    prisma.scheduledShift.findMany({
      where: {
        branchId: input.branchId,
        type: "TURNO",
        publicationStatus: "PUBLISHED",
        date: { gte: yearStart, lt: yearEndExclusive },
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        userId: true,
        user: { select: { hourlyRate: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const paidRows = periods.map((period) => ({
    weekStart: formatDateOnly(period.weekStart),
    amount: allocatePayrollEntries(period.entries, input.branchId).amount,
  }));

  const userIds = [...new Set(scheduledShifts.map((shift) => shift.userId))];
  const salaryRates = userIds.length ? await prisma.salaryRate.findMany({
    where: { userId: { in: userIds }, scheme: "HORA" },
    select: { userId: true, branchId: true, amount: true, effectiveFrom: true, effectiveTo: true },
    orderBy: { effectiveFrom: "desc" },
  }) : [];
  const ratesByUser = new Map<string, HourlyRateRow[]>();
  for (const rate of salaryRates) {
    const rows = ratesByUser.get(rate.userId) ?? [];
    rows.push({ branchId: rate.branchId, amount: Number(rate.amount), effectiveFrom: rate.effectiveFrom, effectiveTo: rate.effectiveTo });
    ratesByUser.set(rate.userId, rows);
  }

  const budgetRows = scheduledShifts.map((shift) => {
    const date = formatDateOnly(shift.date);
    const rates = ratesByUser.get(shift.userId) ?? [];
    const generalRate = rates.find((rate) => rate.branchId === null && rate.effectiveFrom <= shift.date && (rate.effectiveTo === null || rate.effectiveTo > shift.date));
    const fallbackRate = shift.user.hourlyRate === null ? null : Number(shift.user.hourlyRate);
    const hourlyRate = resolveBranchHourlyRate(rates, input.branchId, shift.date, generalRate?.amount ?? fallbackRate);
    const amount = computeHourlyPay(shiftHours(shift.startTime, shift.endTime), hourlyRate);
    return { date, weekStart: periodRange("week", date).from, amount };
  });

  const sumPaid = (range: { from: string; to: string }) => paidRows
    .filter((row) => row.weekStart >= range.from && row.weekStart <= range.to)
    .reduce((sum, row) => sum + row.amount, 0);
  const sumBudget = (range: { from: string; to: string }) => budgetRows
    .filter((row) => row.date >= range.from && row.date <= range.to)
    .reduce((sum, row) => sum + row.amount, 0);

  const paidWeeks = new Map<string, number>();
  const budgetWeeks = new Map<string, number>();
  for (const row of paidRows) addAmount(paidWeeks, row.weekStart, row.amount);
  for (const row of budgetRows) addAmount(budgetWeeks, row.weekStart, row.amount);
  const weekKeys = [...new Set([...paidWeeks.keys(), ...budgetWeeks.keys()])].sort();
  const weekTrend = weekKeys.map((key) => ({
    key,
    label: key.slice(5),
    paid: paidWeeks.get(key) ?? 0,
    budget: budgetWeeks.get(key) ?? 0,
  }));

  const monthAmounts = new Map<string, { paid: number; budget: number }>();
  for (let month = 1; month <= 12; month += 1) {
    const key = `${yearRange.from.slice(0, 4)}-${String(month).padStart(2, "0")}`;
    monthAmounts.set(key, { paid: 0, budget: 0 });
  }
  for (const row of paidRows) {
    const item = monthAmounts.get(row.weekStart.slice(0, 7));
    if (item) item.paid += row.amount;
  }
  for (const row of budgetRows) {
    const item = monthAmounts.get(row.date.slice(0, 7));
    if (item) item.budget += row.amount;
  }

  return {
    week: sumPaid(weekRange),
    month: sumPaid(monthRange),
    year: sumPaid(yearRange),
    budgetWeek: sumBudget(weekRange),
    budgetMonth: sumBudget(monthRange),
    budgetYear: sumBudget(yearRange),
    weekTrend,
    monthTrend: [...monthAmounts].map(([key, amount]) => ({ key, label: monthLabel(key), ...amount })),
  };
}
