import {
  addDaysToDateOnly,
  businessDayStart,
  formatBusinessDateOnly,
} from "@/lib/dateOnly";

/** Día al que pertenece una checada según la operación en Ciudad de México. */
export function payrollBusinessDate(clockIn: Date): string {
  return formatBusinessDateOnly(clockIn);
}

/** Rango de instantes UTC que cubre una semana laboral local, lunes a lunes. */
export function payrollWeekInstantRange(monday: string): { start: Date; end: Date } {
  return {
    start: businessDayStart(monday),
    end: businessDayStart(addDaysToDateOnly(monday, 7)),
  };
}

/** Pago lineal de nómina: todas las horas reales se pagan a la tarifa normal. */
export function computeHourlyPay(totalHours: number, hourlyRate: number | null): number {
  return hourlyRate === null ? 0 : totalHours * hourlyRate;
}
