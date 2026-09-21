import {
  addDaysToDateOnly,
  firstDayOfMonth,
  lastDayOfMonth,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";

export const CASH_CUT_PERIODS = [
  "current-week",
  "last-week",
  "current-month",
  "current-year",
  "custom",
] as const;

export type CashCutPeriod = (typeof CASH_CUT_PERIODS)[number];

export type CurrentCashCutWeek = {
  startDate: string;
  endDate: string;
  from: Date;
  to: Date;
};

export type CashCutDateRange = CurrentCashCutWeek;

/** Semana de negocio actual: lunes a domingo, en America/Mexico_City. */
export function getCurrentCashCutWeek(today = todayDateOnly()): CurrentCashCutWeek {
  const startDate = mondayOfWeek(today);
  const endDate = addDaysToDateOnly(startDate, 6);

  return {
    startDate,
    endDate,
    from: parseDateOnly(startDate),
    to: parseDateOnly(endDate),
  };
}

/** Rangos de calendario del tablero, independientes del huso del servidor. */
export function getCashCutPeriodRange(
  period: CashCutPeriod,
  options: { today?: string; from?: string; to?: string } = {},
): CashCutDateRange {
  const today = options.today ?? todayDateOnly();
  let startDate: string;
  let endDate: string;

  switch (period) {
    case "last-week": {
      const currentMonday = mondayOfWeek(today);
      startDate = addDaysToDateOnly(currentMonday, -7);
      endDate = addDaysToDateOnly(currentMonday, -1);
      break;
    }
    case "current-month":
      startDate = firstDayOfMonth(today);
      endDate = lastDayOfMonth(today);
      break;
    case "current-year":
      startDate = `${today.slice(0, 4)}-01-01`;
      endDate = `${today.slice(0, 4)}-12-31`;
      break;
    case "custom":
      if (!options.from || !options.to) {
        throw new Error("El rango personalizado requiere fecha inicial y final.");
      }
      startDate = options.from;
      endDate = options.to;
      break;
    default: {
      const week = getCurrentCashCutWeek(today);
      startDate = week.startDate;
      endDate = week.endDate;
    }
  }

  return {
    startDate,
    endDate,
    from: parseDateOnly(startDate),
    to: parseDateOnly(endDate),
  };
}

/**
 * Los cortes abiertos se mantienen visibles aunque hayan iniciado antes del
 * rango elegido. Así nunca pueden bloquear una apertura y quedar ocultos.
 */
export function getCashCutRangeVisibilityWhere(range: CashCutDateRange) {
  return {
    OR: [
      { status: "ABIERTO" as const },
      { date: { gte: range.from, lte: range.to } },
    ],
  };
}

export function getCashCutVisibilityWhere(today = todayDateOnly()) {
  return getCashCutRangeVisibilityWhere(getCurrentCashCutWeek(today));
}

/**
 * ADMIN usa `branchIds === null` para representar acceso global. En ese caso
 * no se agrega filtro de sucursal; los demas roles conservan exclusivamente
 * su sucursal de trabajo resuelta en el servidor.
 */
export function getCashCutBranchWhere(
  branchIds: string[] | null,
  workingBranchId: string | null,
) {
  if (branchIds === null) return {};
  if (workingBranchId) return { branchId: workingBranchId };
  return { branchId: { in: [] as string[] } };
}
