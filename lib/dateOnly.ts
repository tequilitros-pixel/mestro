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

/** "YYYY-MM-DD" -> Date anclado a medianoche UTC. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}
