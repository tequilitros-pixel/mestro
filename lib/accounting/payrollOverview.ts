import { periodRange, type AccountingPeriod } from "@/lib/accounting";
import { addDaysToDateOnly, businessDayStart, formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import { computeHourlyPay } from "@/lib/payroll/legacyRules";
import { resolveBranchHourlyRate, type HourlyRateRow } from "@/lib/payroll/branchRates";
import { prisma } from "@/lib/prisma";
import { allocatePayrollEntry } from "./payrollAllocation";

type PayrollOverviewPeriod = {
  weekStart: Date;
  entries: Array<{
    totalPay: unknown;
    basePay: unknown;
    overtimePay: unknown;
    daysSnapshot: unknown;
  }>;
};

type TrendGranularity = "day" | "week" | "month";

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
  periodTrend: PayrollTrendPoint[];
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

function datesInRange(from: string, to: string) {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDaysToDateOnly(date, 1)) dates.push(date);
  return dates;
}

function trendKey(date: string, granularity: TrendGranularity) {
  if (granularity === "day") return date;
  if (granularity === "month") return date.slice(0, 7);
  return periodRange("week", date).from;
}

function trendLabel(key: string, granularity: TrendGranularity) {
  if (granularity === "month") return monthLabel(key);
  return key.slice(5);
}

function selectedGranularity(period: AccountingPeriod): TrendGranularity {
  if (period === "year") return "month";
  if (period === "month") return "week";
  return "day";
}

function buildTrend(input: {
  range: { from: string; to: string };
  period: AccountingPeriod;
  paidByDay: Map<string, number>;
  budgetByDay: Map<string, number>;
}): PayrollTrendPoint[] {
  const granularity = selectedGranularity(input.period);
  const paid = new Map<string, number>();
  const budget = new Map<string, number>();
  const keys = new Set<string>();
  for (const date of datesInRange(input.range.from, input.range.to)) {
    const key = trendKey(date, granularity);
    keys.add(key);
    addAmount(paid, key, input.paidByDay.get(date) ?? 0);
    addAmount(budget, key, input.budgetByDay.get(date) ?? 0);
  }
  return [...keys].sort().map((key) => ({ key, label: trendLabel(key, granularity), paid: paid.get(key) ?? 0, budget: budget.get(key) ?? 0 }));
}

/** Resume la nómina pagada y el costo teórico publicado del calendario de una sucursal. */
export async function getBranchPayrollOverview(input: { branchId: string; anchor: string; period: AccountingPeriod }): Promise<BranchPayrollOverview> {
  const weekRange = periodRange("week", input.anchor);
  const monthRange = periodRange("month", input.anchor);
  const yearRange = periodRange("year", input.anchor);
  const selectedRange = periodRange(input.period, input.anchor);
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

  const paidByDay = new Map<string, number>();
  for (const period of periods) {
    const daily = new Map<string, number>();
    for (const entry of period.entries) {
      for (const day of allocatePayrollEntry(entry, input.branchId).days) addAmount(daily, day.date, day.amount);
    }
    for (const [date, amount] of daily) addAmount(paidByDay, date, amount);
  }

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

  const budgetByDay = new Map<string, number>();
  for (const shift of scheduledShifts) {
    const date = formatDateOnly(shift.date);
    const rates = ratesByUser.get(shift.userId) ?? [];
    const generalRate = rates.find((rate) => rate.branchId === null && rate.effectiveFrom <= shift.date && (rate.effectiveTo === null || rate.effectiveTo > shift.date));
    const fallbackRate = shift.user.hourlyRate === null ? null : Number(shift.user.hourlyRate);
    const hourlyRate = resolveBranchHourlyRate(rates, input.branchId, shift.date, generalRate?.amount ?? fallbackRate);
    addAmount(budgetByDay, date, computeHourlyPay(shiftHours(shift.startTime, shift.endTime), hourlyRate));
  }

  const sumPaid = (range: { from: string; to: string }) => [...paidByDay]
    .filter(([date]) => date >= range.from && date <= range.to)
    .reduce((sum, [, amount]) => sum + amount, 0);
  const sumBudget = (range: { from: string; to: string }) => [...budgetByDay]
    .filter(([date]) => date >= range.from && date <= range.to)
    .reduce((sum, [, amount]) => sum + amount, 0);

  const periodTrend = buildTrend({ range: selectedRange, period: input.period, paidByDay, budgetByDay });
  const yearTrend = buildTrend({ range: yearRange, period: "year", paidByDay, budgetByDay });
  const monthKeys = input.period === "year" ? yearTrend.map((point) => point.key) : [input.anchor.slice(0, 7)];
  const monthTrend = yearTrend.filter((point) => monthKeys.includes(point.key));

  return {
    week: sumPaid(weekRange),
    month: sumPaid(monthRange),
    year: sumPaid(yearRange),
    budgetWeek: sumBudget(weekRange),
    budgetMonth: sumBudget(monthRange),
    budgetYear: sumBudget(yearRange),
    periodTrend,
    weekTrend: periodTrend,
    monthTrend,
  };
}
