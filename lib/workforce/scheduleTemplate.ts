export type MinuteRange = readonly [number, number];

/** Convierte un bloque horario en un rango continuo; soporta salida después de medianoche. */
export function shiftRangeMinutes(startTime: string, endTime: string): MinuteRange {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 1440;
  return [start, end];
}

export function rangesOverlap(left: MinuteRange, right: MinuteRange) {
  return left[0] < right[1] && right[0] < left[1];
}

export function validTemplateWeekday(dayOfWeek: number) {
  return Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6;
}

export function validBreakMinutes(breakMinutes: number) {
  return Number.isInteger(breakMinutes) && breakMinutes >= 0 && breakMinutes <= 720;
}
