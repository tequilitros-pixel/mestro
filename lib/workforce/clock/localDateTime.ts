type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function parseParts(value: string): LocalDateTimeParts & { millisecond: number } {
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error("Hora propuesta inválida.");
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "").padEnd(3, "0") || 0),
  };
  const check = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ),
  );
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day ||
    check.getUTCHours() !== parts.hour ||
    check.getUTCMinutes() !== parts.minute ||
    check.getUTCSeconds() !== parts.second ||
    check.getUTCMilliseconds() !== parts.millisecond
  )
    throw new Error("Hora propuesta inválida.");
  return parts;
}

function zonedParts(value: Date, timeZone: string): LocalDateTimeParts {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "iso8601",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function asWallClockMilliseconds(parts: LocalDateTimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function zoneOffsetMilliseconds(value: Date, timeZone: string): number {
  return asWallClockMilliseconds(zonedParts(value, timeZone)) - value.getTime();
}

export function parseLocalDateTimeInZone(value: string, timeZone: string): Date {
  const local = parseParts(value);
  const wallClockMilliseconds = asWallClockMilliseconds(local);
  const firstOffset = zoneOffsetMilliseconds(
    new Date(wallClockMilliseconds),
    timeZone,
  );
  const firstCandidate = new Date(wallClockMilliseconds - firstOffset);
  const secondOffset = zoneOffsetMilliseconds(firstCandidate, timeZone);
  const candidate = new Date(wallClockMilliseconds - secondOffset);
  const resolved = zonedParts(candidate, timeZone);
  if (
    resolved.year !== local.year ||
    resolved.month !== local.month ||
    resolved.day !== local.day ||
    resolved.hour !== local.hour ||
    resolved.minute !== local.minute ||
    resolved.second !== local.second
  )
    throw new Error("Hora propuesta inválida para la zona horaria de la sucursal.");
  candidate.setUTCMilliseconds(local.millisecond);
  return candidate;
}
