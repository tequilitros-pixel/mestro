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
