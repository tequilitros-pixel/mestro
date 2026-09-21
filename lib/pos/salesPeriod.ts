import {
  addDaysToDateOnly,
  firstDayOfMonth,
  formatDateOnly,
  lastSalesDayOfMonth,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "../dateOnly";

export type SalesPeriod = "day" | "week" | "month" | "custom";

export type SalesPeriodRange = {
  from: string;
  to: string;
};

export function salesPeriodDateRange(
  period: Exclude<SalesPeriod, "custom">,
  referenceDate = todayDateOnly(),
): SalesPeriodRange {
  if (period === "week") {
    const monday = mondayOfWeek(referenceDate);
    return { from: monday, to: addDaysToDateOnly(monday, 6) };
  }

  if (period === "month") {
    return {
      from: firstDayOfMonth(referenceDate),
      to: lastSalesDayOfMonth(referenceDate),
    };
  }

  return { from: referenceDate, to: referenceDate };
}

function shiftMonth(date: string, direction: -1 | 1): string {
  const month = parseDateOnly(firstDayOfMonth(date));
  month.setUTCMonth(month.getUTCMonth() + direction);
  return formatDateOnly(month);
}

/** Mueve el periodo completo sin convertir fechas civiles a la hora local. */
export function shiftSalesPeriodRange(
  period: SalesPeriod,
  range: SalesPeriodRange,
  direction: -1 | 1,
): SalesPeriodRange {
  if (period === "day") {
    const date = addDaysToDateOnly(range.from, direction);
    return { from: date, to: date };
  }

  if (period === "week") {
    return {
      from: addDaysToDateOnly(range.from, direction * 7),
      to: addDaysToDateOnly(range.to, direction * 7),
    };
  }

  if (period === "month") {
    const month = shiftMonth(range.from, direction);
    return {
      from: firstDayOfMonth(month),
      to: lastSalesDayOfMonth(month),
    };
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const inclusiveDays =
    Math.round(
      (parseDateOnly(range.to).getTime() - parseDateOnly(range.from).getTime()) /
        millisecondsPerDay,
    ) + 1;

  return {
    from: addDaysToDateOnly(range.from, direction * inclusiveDays),
    to: addDaysToDateOnly(range.to, direction * inclusiveDays),
  };
}
