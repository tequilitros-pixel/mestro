export const BUSINESS_TIME_ZONE = "America/Mexico_City";

type DateTimeValue = Date | string | number;

function asDate(value: DateTimeValue): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatBusinessDateTime(value: DateTimeValue): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asDate(value));
}

export function formatBusinessTime(value: DateTimeValue): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(asDate(value));
}
