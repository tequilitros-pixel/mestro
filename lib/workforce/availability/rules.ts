export type AvailabilityState = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
export type AvailabilitySource = "EXCEPTION" | "RECURRING" | "NONE";

export type AvailabilityFact = {
  state: Exclude<AvailabilityState, "UNKNOWN">;
  startTime: string | null;
  endTime: string | null;
  source: Exclude<AvailabilitySource, "NONE">;
  reason: string | null;
};

export type EffectiveAvailability = AvailabilityFact | {
  state: "UNKNOWN";
  startTime: null;
  endTime: null;
  source: "NONE";
  reason: "NO_AVAILABILITY_DECLARED";
};

export type RecurringRule = {
  dayOfWeek: number;
  available: boolean;
  startTime: string | null;
  endTime: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export type DatedException = {
  type: "AVAILABLE" | "UNAVAILABLE";
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export const URGENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function dateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida.");
  return date;
}

export function validateTimeRange(startTime: string | null, endTime: string | null) {
  const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((startTime === null) !== (endTime === null)) throw new Error("Captura inicio y fin, o deja ambos vacíos.");
  if (startTime && (!pattern.test(startTime) || !pattern.test(endTime!))) throw new Error("La hora debe usar formato HH:mm.");
  if (startTime === endTime && startTime !== null) throw new Error("Inicio y fin no pueden ser iguales.");
}

export function effectiveAvailability(input: { date: Date; rules: RecurringRule[]; exception?: DatedException | null }): EffectiveAvailability {
  if (input.exception) return {
    state: input.exception.type,
    startTime: input.exception.startTime,
    endTime: input.exception.endTime,
    source: "EXCEPTION",
    reason: input.exception.reason,
  };
  const day = dateOnly(input.date);
  const rule = input.rules
    .filter((item) => item.dayOfWeek === day.getUTCDay() && (!item.effectiveFrom || dateOnly(item.effectiveFrom) <= day) && (!item.effectiveTo || dateOnly(item.effectiveTo) >= day))
    .sort((a, b) => (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0))[0];
  if (!rule) return { state: "UNKNOWN", startTime: null, endTime: null, source: "NONE", reason: "NO_AVAILABILITY_DECLARED" };
  return { state: rule.available ? "AVAILABLE" : "UNAVAILABLE", startTime: rule.startTime, endTime: rule.endTime, source: "RECURRING", reason: null };
}

export function requiresManagerAttention(input: { now: Date; effectiveDate: Date; publishedShiftDates: Date[] }) {
  const date = dateOnly(input.effectiveDate);
  const today = dateOnly(input.now);
  const urgencyEndDate = dateOnly(new Date(input.now.getTime() + URGENCY_WINDOW_MS));
  const urgent = date >= today && date <= urgencyEndDate;
  const publishedShift = input.publishedShiftDates.some((item) => dateOnly(item).getTime() === date.getTime());
  return { required: urgent || publishedShift, urgent, publishedShift };
}

export function shiftAvailabilityConflict(availability: EffectiveAvailability) {
  return availability.state === "UNAVAILABLE" ? "SOFT_CONFLICT" as const : availability.state === "UNKNOWN" ? "UNKNOWN" as const : "NONE" as const;
}

export function schedulingEligibility(input: { employmentStatus: string; branchAuthorized: boolean; overlapsShift: boolean; availability: EffectiveAvailability }) {
  const hardBlocks = [input.employmentStatus !== "ACTIVE" ? "INACTIVE_EMPLOYMENT" : null, !input.branchAuthorized ? "UNAUTHORIZED_BRANCH" : null, input.overlapsShift ? "OVERLAPPING_SHIFT" : null].filter((item): item is string => Boolean(item));
  return { hardBlocks, availability: shiftAvailabilityConflict(input.availability) };
}
