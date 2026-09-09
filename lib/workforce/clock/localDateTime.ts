const DEFAULT_TIME_ZONE = "America/Mexico_City";

type ZonedParts = {
  date: string;
  time: string;
};

function partsAt(value: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const raw = parts.find((part) => part.type === type)?.value;
    if (!raw) throw new Error("No se pudo leer la fecha local.");
    return Number(raw);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

export function formatZonedDateTimeParts(value: Date, timeZone = DEFAULT_TIME_ZONE): ZonedParts {
  const local = partsAt(value, timeZone);
  return {
    date: `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
    time: `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`,
  };
}

export function formatZonedDateTimeLocal(
  value: Date | null | undefined,
  timeZone: string | null | undefined,
) {
  if (!value) return "Sin registrar";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone ?? DEFAULT_TIME_ZONE,
  }).format(value);
}

export function parseZonedDateTimeLocal(date: string, time: string, timeZone = DEFAULT_TIME_ZONE): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Fecha y hora inválidas.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new Error("Fecha y hora inválidas.");
  }

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wallAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const local = partsAt(new Date(guess), timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const next = guess + wallAsUtc - representedAsUtc;
    if (next === guess) break;
    guess = next;
  }

  const result = new Date(guess);
  const check = formatZonedDateTimeParts(result, timeZone);
  if (check.date !== date || check.time !== time) {
    throw new Error("La hora local no existe en la zona horaria indicada.");
  }
  return result;
}
