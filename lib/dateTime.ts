/**
 * Fuente única de verdad para instantes y calendario de negocio.
 *
 * Los instantes se persisten como Date/ISO (UTC internamente). Las fechas y
 * horas que una persona captura o ve se interpretan/formatean explícitamente
 * en la zona IANA del negocio; nunca en la zona del servidor o del navegador.
 */
export const BUSINESS_TIME_ZONE = "America/Mexico_City";

type DateTimeValue = Date | string | number;
type CivilDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  const cached = PARTS_FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  PARTS_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

function asDate(value: DateTimeValue): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida.");
  return date;
}

function civilParts(value: Date, timeZone = BUSINESS_TIME_ZONE): CivilDateTime {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: 0,
  };
}

function wallClockAsUtc(value: CivilDateTime) {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.millisecond,
  );
}

function sameCivilParts(a: CivilDateTime, b: CivilDateTime) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function parseCivilDateTime(value: string): CivilDateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value.trim());
  if (!match) throw new Error("Fecha y hora inválidas; usa YYYY-MM-DDTHH:mm.");
  const [, year, month, day, hour, minute, second = "0", fraction = ""] = match;
  const result = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(fraction.padEnd(3, "0") || 0),
  };
  const check = new Date(wallClockAsUtc(result));
  if (
    check.getUTCFullYear() !== result.year ||
    check.getUTCMonth() + 1 !== result.month ||
    check.getUTCDate() !== result.day ||
    check.getUTCHours() !== result.hour ||
    check.getUTCMinutes() !== result.minute ||
    check.getUTCSeconds() !== result.second
  ) throw new Error("Fecha y hora inválidas.");
  return result;
}

/** Instante actual. Kept as a named seam for deterministic callers/tests. */
export function nowBusinessInstant(): Date {
  return new Date();
}

export function formatBusinessDateTime(value: DateTimeValue): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asDate(value));
}

export function formatBusinessDate(
  value: DateTimeValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat("es-MX", {
    ...options,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asDate(value));
}

/** Formats a civil date stored at UTC midnight; it is not an instant. */
export function formatCivilDate(
  value: DateTimeValue,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat("es-MX", {
    ...options,
    timeZone: "UTC",
  }).format(asDate(value));
}

export function formatBusinessTime(value: DateTimeValue): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asDate(value));
}

/** Date -> YYYY-MM-DD in the business calendar. */
export function formatBusinessDateOnly(value: DateTimeValue): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return dateOnlyFromParts(parseDateOnly(value));
  }
  const parts = civilParts(asDate(value));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Formats an instant for an input type=datetime-local in business time. */
export function formatBusinessDateTimeLocal(value: DateTimeValue): string {
  const parts = civilParts(asDate(value));
  return `${formatBusinessDateOnly(value)}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/**
 * Interprets a datetime-local value in an IANA zone and returns the absolute
 * instant. No host timezone or fixed UTC offset is involved. Nonexistent wall
 * times (DST gaps) are rejected instead of guessed.
 */
export function parseZonedDateTimeLocal(
  value: string,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const target = parseCivilDateTime(value);
  const wall = wallClockAsUtc(target);
  let candidate = wall;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const represented = wallClockAsUtc(civilParts(new Date(candidate), timeZone));
    const correction = wall - represented;
    candidate += correction;
    if (correction === 0) {
      const resolved = new Date(candidate);
      if (sameCivilParts(civilParts(resolved, timeZone), target)) return resolved;
    }
  }
  throw new Error(`La hora ${value} no existe en ${timeZone}.`);
}

/** Interprets a datetime-local value as Mexico City civil time. */
export function parseBusinessDateTimeLocal(value: string): Date {
  return parseZonedDateTimeLocal(value, BUSINESS_TIME_ZONE);
}

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error("Fecha inválida; usa YYYY-MM-DD.");
  const [, year, month, day] = match;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() + 1 !== Number(month) ||
    check.getUTCDate() !== Number(day)
  ) throw new Error("Fecha inválida; usa YYYY-MM-DD.");
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function dateOnlyFromParts(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addCivilDays(value: string, days: number) {
  const parts = parseDateOnly(value);
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateOnlyFromParts({
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  });
}

/** Suma días calendario sin depender de la zona horaria del host. */
export function addBusinessDays(value: DateTimeValue | string, days: number): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : formatBusinessDateOnly(value as DateTimeValue);
  return addCivilDays(date, days);
}

/** [start, end) for a business day. */
export function businessDayRange(value: DateTimeValue | string): { start: Date; end: Date } {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : formatBusinessDateOnly(value as DateTimeValue);
  return {
    start: parseBusinessDateTimeLocal(`${date}T00:00`),
    end: parseBusinessDateTimeLocal(`${addCivilDays(date, 1)}T00:00`),
  };
}

export function businessDayStart(value: DateTimeValue | string): Date {
  return businessDayRange(value).start;
}

export function businessDayEnd(value: DateTimeValue | string): Date {
  return new Date(businessDayRange(value).end.getTime() - 1);
}

export function sameBusinessDay(a: DateTimeValue, b: DateTimeValue): boolean {
  return formatBusinessDateOnly(a) === formatBusinessDateOnly(b);
}

/** Monday-start business week as [start, end), preserving civil dates. */
export function businessWeekRange(value: DateTimeValue | string): { start: Date; end: Date } {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : formatBusinessDateOnly(value as DateTimeValue);
  const parts = parseDateOnly(date);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const monday = addCivilDays(date, weekday === 0 ? -6 : 1 - weekday);
  return {
    start: businessDayStart(monday),
    end: businessDayStart(addCivilDays(monday, 7)),
  };
}

export function businessDateLabel(value: DateTimeValue): string {
  return formatBusinessDateTime(value);
}
