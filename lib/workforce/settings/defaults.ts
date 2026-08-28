export type WorkforcePolicyValues = {
  version: number;
  effectiveFrom: Date;
  companyTimezone: string;
  payWeekStartsOn: number;
  payDay: number;
  scheduledHoursWarningMinutes: number;
  preventiveOvertimeWarningMinutes: number;
  allowUnassignedShiftPublication: boolean;
  allowAvailabilityWarningPublication: boolean;
  allowUnscheduledWork: boolean;
  shiftLinkProximityMinutes: number;
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  longBreakThresholdMinutes: number;
  noShowThresholdMinutes: number;
  missingClockOutThresholdMinutes: number;
  legalDayOrdinaryLimitMinutes: number;
  legalNightOrdinaryLimitMinutes: number;
  legalMixedOrdinaryLimitMinutes: number;
  legalWeeklyDoubleLimitMinutes: number;
  legalPolicyCode: string;
};

export const DEFAULT_WORKFORCE_POLICY: Readonly<WorkforcePolicyValues> = Object.freeze({
  version: 1,
  effectiveFrom: new Date("1970-01-01T00:00:00.000Z"),
  companyTimezone: "America/Mexico_City",
  payWeekStartsOn: 1,
  payDay: 1,
  scheduledHoursWarningMinutes: 2880,
  preventiveOvertimeWarningMinutes: 2880,
  allowUnassignedShiftPublication: true,
  allowAvailabilityWarningPublication: true,
  allowUnscheduledWork: true,
  shiftLinkProximityMinutes: 720,
  lateGraceMinutes: 5,
  earlyDepartureGraceMinutes: 5,
  longBreakThresholdMinutes: 60,
  noShowThresholdMinutes: 30,
  missingClockOutThresholdMinutes: 60,
  legalDayOrdinaryLimitMinutes: 480,
  legalNightOrdinaryLimitMinutes: 420,
  legalMixedOrdinaryLimitMinutes: 450,
  legalWeeklyDoubleLimitMinutes: 540,
  legalPolicyCode: "MX_OVERTIME_V1_2026",
});
