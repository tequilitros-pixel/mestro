import { addDaysToDateOnly, mondayOfWeek, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";

export type CurrentCashCutWeek = {
  startDate: string;
  endDate: string;
  from: Date;
  to: Date;
};

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

/**
 * Los cortes cerrados se limitan a la semana vigente, pero un corte abierto
 * siempre debe permanecer visible. De otro modo puede bloquear una apertura
 * nueva sin que el usuario tenga forma de encontrarlo y cerrarlo.
 */
export function getCashCutVisibilityWhere(today = todayDateOnly()) {
  const week = getCurrentCashCutWeek(today);

  return {
    OR: [
      { status: "ABIERTO" as const },
      { date: { gte: week.from, lte: week.to } },
    ],
  };
}
