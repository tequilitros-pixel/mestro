import type { EffectiveAvailability } from "@/lib/workforce/availability/rules";

export const DEFAULT_OVERTIME_RISK_HOURS = 48;
export const DAY_MS = 86_400_000;

export type ShiftWindow = {
  id?: string;
  employmentId: string | null;
  branchId: string;
  businessDate: Date;
  startAt: Date;
  endAt: Date;
  status?: string;
};
export type SchedulingBlocker =
  | "INACTIVE_EMPLOYMENT"
  | "UNAUTHORIZED_BRANCH"
  | "OVERLAPPING_SHIFT"
  | "INVALID_WINDOW"
  | "OUTSIDE_PERIOD";
export type SchedulingWarning =
  | "UNASSIGNED"
  | "UNAVAILABLE"
  | "UNKNOWN_AVAILABILITY"
  | "OVERTIME_RISK"
  | "COVERAGE_GAP";

export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
export function weekEnd(weekStart: Date) {
  return new Date(weekStart.getTime() + 6 * DAY_MS);
}

export function localDateTimeToInstant(
  date: Date,
  time: string,
  timezone: string,
) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Hora inválida; usa HH:mm.");
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
  );
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let candidate = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    candidate += target - represented;
  }
  return new Date(candidate);
}

export function shiftInstants(input: {
  businessDate: Date;
  startTime: string;
  endTime: string;
  timezone: string;
}) {
  const startAt = localDateTimeToInstant(
    input.businessDate,
    input.startTime,
    input.timezone,
  );
  let endAt = localDateTimeToInstant(
    input.businessDate,
    input.endTime,
    input.timezone,
  );
  if (endAt <= startAt)
    endAt = localDateTimeToInstant(
      new Date(input.businessDate.getTime() + DAY_MS),
      input.endTime,
      input.timezone,
    );
  if (endAt <= startAt) throw new Error("El fin debe ser posterior al inicio.");
  return { startAt, endAt };
}

export function windowsOverlap(
  a: Pick<ShiftWindow, "startAt" | "endAt">,
  b: Pick<ShiftWindow, "startAt" | "endAt">,
) {
  return a.startAt < b.endAt && a.endAt > b.startAt;
}
export function scheduledHours(
  shifts: Array<
    Pick<ShiftWindow, "employmentId" | "startAt" | "endAt" | "status">
  >,
) {
  const totals = new Map<string, number>();
  for (const shift of shifts)
    if (shift.employmentId && shift.status !== "CANCELLED")
      totals.set(
        shift.employmentId,
        (totals.get(shift.employmentId) ?? 0) +
          (shift.endAt.getTime() - shift.startAt.getTime()) / 3_600_000,
      );
  return totals;
}

export function availabilityWarning(
  availability: EffectiveAvailability,
): SchedulingWarning | null {
  return availability.state === "UNAVAILABLE"
    ? "UNAVAILABLE"
    : availability.state === "UNKNOWN"
      ? "UNKNOWN_AVAILABILITY"
      : null;
}
export function overtimeRisk(
  hours: number,
  threshold = DEFAULT_OVERTIME_RISK_HOURS,
) {
  return {
    risk: hours > threshold,
    hours,
    threshold,
    excessHours: Math.max(0, hours - threshold),
  };
}

export function coverageStatus(required: number, scheduled: number) {
  const gap = scheduled - required;
  return {
    required,
    scheduled,
    gap,
    status:
      gap < 0
        ? ("UNDERSTAFFED" as const)
        : gap > 0
          ? ("OVERSTAFFED" as const)
          : ("COVERED" as const),
  };
}

export function calculateCoverage(
  requirement: { startAt: Date; endAt: Date; requiredCount: number },
  shifts: ShiftWindow[],
) {
  const scheduled = shifts.filter(
    (shift) =>
      shift.status !== "CANCELLED" && windowsOverlap(requirement, shift),
  ).length;
  return coverageStatus(requirement.requiredCount, scheduled);
}

export function validateShiftFacts(input: {
  shift: ShiftWindow;
  periodStart: Date;
  periodEnd: Date;
  employmentStatus?: string;
  branchAuthorized?: boolean;
  overlaps?: boolean;
}) {
  const blockers: SchedulingBlocker[] = [];
  const warnings: SchedulingWarning[] = [];
  if (input.shift.endAt <= input.shift.startAt) blockers.push("INVALID_WINDOW");
  if (
    input.shift.businessDate < input.periodStart ||
    input.shift.businessDate > input.periodEnd
  )
    blockers.push("OUTSIDE_PERIOD");
  if (!input.shift.employmentId) warnings.push("UNASSIGNED");
  else {
    if (input.employmentStatus !== "ACTIVE")
      blockers.push("INACTIVE_EMPLOYMENT");
    if (!input.branchAuthorized) blockers.push("UNAUTHORIZED_BRANCH");
    if (input.overlaps) blockers.push("OVERLAPPING_SHIFT");
  }
  return { blockers, warnings };
}

export function assertSchedulingBranchAccess(
  actorRole: string,
  accessibleBranchIds: string[] | null,
  branchId: string,
) {
  if (actorRole === "ADMIN") return;
  if (!accessibleBranchIds?.includes(branchId))
    throw new Error("No autorizado para programar esta sucursal.");
}
