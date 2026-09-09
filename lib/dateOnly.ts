/**
 * Utilidades para trabajar con fechas de calendario ("YYYY-MM-DD",
 * sin hora) sin depender del huso horario del entorno donde corre
 * el código.
 *
 * El problema que resuelven: en producción el servidor corre en UTC,
 * pero en desarrollo local corre en la zona horaria de México
 * (UTC-6). Si se parsea una fecha como `new Date("2026-07-27")`
 * (medianoche UTC) y luego se usan métodos locales como `getDate()`,
 * `getDay()` o `setHours()`, en México esa fecha se lee como el día
 * anterior a las 6pm — lo que corrompe cálculos de "lunes de la
 * semana", rangos de fechas, etc. Estas funciones solo usan métodos
 * UTC, así que el resultado es el mismo sin importar dónde se ejecuten.
 */

import {
  businessDayStart as businessDayStartInZone,
  formatBusinessDateOnly as formatBusinessDateOnlyInZone,
} from "./dateTime";

export { BUSINESS_TIME_ZONE } from "./dateTime";

/** "YYYY-MM-DD" -> Date anclado a medianoche UTC. */
export function parseDateOnly(dateStr: string): Date {
  const value = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Fecha inválida; usa YYYY-MM-DD.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new Error("Fecha inválida; usa YYYY-MM-DD.");
  }
  return date;
}

/** Date -> "YYYY-MM-DD", leyendo el calendario en UTC. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma (o resta, con un número negativo) días a una fecha de calendario. */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

/** Día de la semana (0 = domingo … 6 = sábado) de una fecha de calendario. */
export function weekdayOfDateOnly(dateStr: string): number {
  return parseDateOnly(dateStr).getUTCDay();
}

/** Lunes de la semana que contiene la fecha dada. */
export function mondayOfWeek(dateStr: string): string {
  const day = weekdayOfDateOnly(dateStr);
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysToDateOnly(dateStr, diff);
}

/**
 * Fecha de calendario "de hoy" en la zona horaria del negocio
 * (Destiladora del Norte opera en México), sin importar el huso
 * horario del servidor o navegador donde se ejecute.
 */
export function todayDateOnly(): string {
  return formatBusinessDateOnly(new Date());
}

/** Date -> fecha de calendario en la zona horaria del negocio. */
export function formatBusinessDateOnly(date: Date): string {
  return formatBusinessDateOnlyInZone(date);
}

/**
 * Inicio UTC de una fecha de calendario en la zona horaria del negocio.
 * El calculo consulta el offset real de Intl para no depender del huso del
 * servidor ni codificar UTC-6 manualmente.
 */
export function businessDayStart(dateStr: string): Date {
  return businessDayStartInZone(dateStr);
}

/** Primer día del mes que contiene la fecha dada. */
export function firstDayOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Último día del mes que contiene la fecha dada. */
export function lastDayOfMonth(dateStr: string): string {
  const [year, month] = dateStr.slice(0, 7).split("-").map(Number);
  const nextMonthFirstDay =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return addDaysToDateOnly(nextMonthFirstDay, -1);
}

/** Dia 30 del mes, o el ultimo dia real cuando el mes es mas corto. */
export function lastSalesDayOfMonth(dateStr: string): string {
  const lastDay = lastDayOfMonth(dateStr);
  return Number(lastDay.slice(-2)) > 30 ? `${dateStr.slice(0, 7)}-30` : lastDay;
}
