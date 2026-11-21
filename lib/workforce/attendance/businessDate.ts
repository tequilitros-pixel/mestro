export const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export function localBusinessDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}
