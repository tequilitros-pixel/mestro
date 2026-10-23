import { addDaysToDateOnly, mondayOfWeek, parseDateOnly } from "@/lib/dateOnly";
import { formatBusinessDateOnly } from "@/lib/dateTime";

export class SafeEnvelopeWeekError extends Error {
  constructor(public readonly code: "INVALID_WEEK" | "WEEK_OUT_OF_SCOPE") {
    super(code);
  }
}

/** Semana lunes-domingo en el calendario de negocio; solo ADMIN puede consultar otras semanas. */
export function resolveSafeEnvelopeWeek(
  requestedWeek: string | null,
  role: string,
  now: Date = new Date(),
) {
  const currentWeekStart = mondayOfWeek(formatBusinessDateOnly(now));
  let weekStart = currentWeekStart;

  if (requestedWeek !== null) {
    try {
      weekStart = mondayOfWeek(requestedWeek);
    } catch {
      throw new SafeEnvelopeWeekError("INVALID_WEEK");
    }
    if (requestedWeek !== weekStart) throw new SafeEnvelopeWeekError("INVALID_WEEK");
  }

  const canNavigateWeeks = role === "ADMIN";
  if (!canNavigateWeeks && weekStart !== currentWeekStart) {
    throw new SafeEnvelopeWeekError("WEEK_OUT_OF_SCOPE");
  }

  return {
    weekStart,
    currentWeekStart,
    canNavigateWeeks,
    // CashCut.date y CashSafeEnvelope.cutDate son fechas civiles a medianoche UTC.
    from: parseDateOnly(weekStart),
    toExclusive: parseDateOnly(addDaysToDateOnly(weekStart, 7)),
  };
}

export function canAccessSafeEnvelopeDate(role: string, cutDate: Date, now: Date = new Date()) {
  if (role === "ADMIN") return true;
  const week = resolveSafeEnvelopeWeek(null, role, now);
  return cutDate >= week.from && cutDate < week.toExclusive;
}
