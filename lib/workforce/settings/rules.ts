import type { WorkforcePolicyValues } from "./defaults";

export type EditableWorkforcePolicy = Omit<
  WorkforcePolicyValues,
  "version" | "effectiveFrom" | "legalPolicyCode"
>;

export const LEGAL_FIELDS = [
  "legalDayOrdinaryLimitMinutes",
  "legalNightOrdinaryLimitMinutes",
  "legalMixedOrdinaryLimitMinutes",
  "legalWeeklyDoubleLimitMinutes",
] as const;

export function assertCanManageWorkforceSettings(
  actor: { role: string } | null | undefined,
) {
  if (actor?.role !== "ADMIN") throw new Error("No autorizado.");
  return actor;
}

export function assertWorkforcePolicy(input: EditableWorkforcePolicy) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.companyTimezone }).format();
  } catch {
    throw new Error("Zona horaria inválida.");
  }
  if (input.payWeekStartsOn !== 1)
    throw new Error("Workforce V1 requiere semana de lunes a domingo.");
  if (!Number.isInteger(input.payDay) || input.payDay < 0 || input.payDay > 6)
    throw new Error("Día de pago inválido.");
  const minuteLimits: Array<[string, number, number]> = [
    ["scheduledHoursWarningMinutes", input.scheduledHoursWarningMinutes, 7 * 24 * 60],
    ["preventiveOvertimeWarningMinutes", input.preventiveOvertimeWarningMinutes, 7 * 24 * 60],
    ["shiftLinkProximityMinutes", input.shiftLinkProximityMinutes, 24 * 60],
    ["lateGraceMinutes", input.lateGraceMinutes, 24 * 60],
    ["earlyDepartureGraceMinutes", input.earlyDepartureGraceMinutes, 24 * 60],
    ["longBreakThresholdMinutes", input.longBreakThresholdMinutes, 24 * 60],
    ["noShowThresholdMinutes", input.noShowThresholdMinutes, 24 * 60],
    ["missingClockOutThresholdMinutes", input.missingClockOutThresholdMinutes, 24 * 60],
    ["legalDayOrdinaryLimitMinutes", input.legalDayOrdinaryLimitMinutes, 24 * 60],
    ["legalNightOrdinaryLimitMinutes", input.legalNightOrdinaryLimitMinutes, 24 * 60],
    ["legalMixedOrdinaryLimitMinutes", input.legalMixedOrdinaryLimitMinutes, 24 * 60],
    ["legalWeeklyDoubleLimitMinutes", input.legalWeeklyDoubleLimitMinutes, 7 * 24 * 60],
  ];
  for (const [field, value, maximum] of minuteLimits)
    if (!Number.isInteger(value) || value < 0 || value > maximum)
      throw new Error(`Valor inválido: ${field}.`);
  if (
    input.legalDayOrdinaryLimitMinutes === 0 ||
    input.legalNightOrdinaryLimitMinutes === 0 ||
    input.legalMixedOrdinaryLimitMinutes === 0
  )
    throw new Error("Los límites legales diarios deben ser positivos.");
  return input;
}

export function resolveEffectivePolicy<T extends { effectiveFrom: Date; version: number }>(
  versions: T[],
  at: Date,
) {
  const candidates = versions
    .filter((item) => item.effectiveFrom <= at)
    .sort(
      (a, b) =>
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        b.version - a.version,
    );
  if (!candidates[0]) throw new Error("WORKFORCE_POLICY_MISSING");
  return candidates[0];
}
