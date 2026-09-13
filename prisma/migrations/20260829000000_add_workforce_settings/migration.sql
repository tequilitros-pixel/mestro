-- Versioned, effective-dated Workforce business policy.
-- System/security invariants remain enforced in code and schema.
CREATE TABLE "WorkforcePolicyVersion" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "companyTimezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
  "payWeekStartsOn" INTEGER NOT NULL DEFAULT 1,
  "payDay" INTEGER NOT NULL DEFAULT 1,
  "scheduledHoursWarningMinutes" INTEGER NOT NULL DEFAULT 2880,
  "preventiveOvertimeWarningMinutes" INTEGER NOT NULL DEFAULT 2880,
  "allowUnassignedShiftPublication" BOOLEAN NOT NULL DEFAULT true,
  "allowAvailabilityWarningPublication" BOOLEAN NOT NULL DEFAULT true,
  "allowUnscheduledWork" BOOLEAN NOT NULL DEFAULT true,
  "shiftLinkProximityMinutes" INTEGER NOT NULL DEFAULT 720,
  "lateGraceMinutes" INTEGER NOT NULL DEFAULT 5,
  "earlyDepartureGraceMinutes" INTEGER NOT NULL DEFAULT 5,
  "longBreakThresholdMinutes" INTEGER NOT NULL DEFAULT 60,
  "noShowThresholdMinutes" INTEGER NOT NULL DEFAULT 30,
  "missingClockOutThresholdMinutes" INTEGER NOT NULL DEFAULT 60,
  "legalDayOrdinaryLimitMinutes" INTEGER NOT NULL DEFAULT 480,
  "legalNightOrdinaryLimitMinutes" INTEGER NOT NULL DEFAULT 420,
  "legalMixedOrdinaryLimitMinutes" INTEGER NOT NULL DEFAULT 450,
  "legalWeeklyDoubleLimitMinutes" INTEGER NOT NULL DEFAULT 540,
  "legalPolicyCode" TEXT NOT NULL DEFAULT 'MX_OVERTIME_V1_2026',
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeReason" TEXT NOT NULL,
  "criticalLegalChange" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkforcePolicyVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkforcePolicyVersion_week_start_check" CHECK ("payWeekStartsOn" = 1),
  CONSTRAINT "WorkforcePolicyVersion_pay_day_check" CHECK ("payDay" BETWEEN 0 AND 6),
  CONSTRAINT "WorkforcePolicyVersion_nonnegative_minutes_check" CHECK (
    "scheduledHoursWarningMinutes" >= 0 AND
    "preventiveOvertimeWarningMinutes" >= 0 AND
    "shiftLinkProximityMinutes" >= 0 AND
    "lateGraceMinutes" >= 0 AND
    "earlyDepartureGraceMinutes" >= 0 AND
    "longBreakThresholdMinutes" >= 0 AND
    "noShowThresholdMinutes" >= 0 AND
    "missingClockOutThresholdMinutes" >= 0 AND
    "legalDayOrdinaryLimitMinutes" > 0 AND
    "legalNightOrdinaryLimitMinutes" > 0 AND
    "legalMixedOrdinaryLimitMinutes" > 0 AND
    "legalWeeklyDoubleLimitMinutes" >= 0
  )
);

CREATE UNIQUE INDEX "WorkforcePolicyVersion_version_key" ON "WorkforcePolicyVersion"("version");
CREATE UNIQUE INDEX "WorkforcePolicyVersion_effectiveFrom_key" ON "WorkforcePolicyVersion"("effectiveFrom");
CREATE INDEX "WorkforcePolicyVersion_effectiveFrom_version_idx" ON "WorkforcePolicyVersion"("effectiveFrom", "version");
ALTER TABLE "WorkforcePolicyVersion" ADD CONSTRAINT "WorkforcePolicyVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "WorkforcePolicyVersion" (
  "id", "version", "effectiveFrom", "changeReason"
) VALUES (
  'workforce_policy_bootstrap_v1', 1, DATE '1970-01-01', 'Bootstrap: preserva el comportamiento Workforce V1 aprobado.'
);
