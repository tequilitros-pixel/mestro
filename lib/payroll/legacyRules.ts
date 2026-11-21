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
  if (hourlyRate === null || !Number.isFinite(hourlyRate) || !Number.isFinite(totalHours)) return 0;
  // Redondea cada registro cobrado a centavos; evita diferencias ocultas
  // entre la suma del recibo y el total persistido.
  const amount = totalHours * hourlyRate;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
