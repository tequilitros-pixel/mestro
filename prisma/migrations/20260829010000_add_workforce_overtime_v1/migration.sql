-- Workforce-native overtime snapshots. Legacy OvertimeRecord is untouched.
CREATE TYPE "WorkforceJornadaType" AS ENUM ('DAY', 'NIGHT', 'MIXED');
CREATE TYPE "WorkforceOvertimeCalculationStatus" AS ENUM ('FINAL', 'STALE');

CREATE TABLE "EmploymentJornadaPolicy" (
  "id" TEXT NOT NULL,
  "employmentId" TEXT NOT NULL,
  "jornadaType" "WorkforceJornadaType" NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmploymentJornadaPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmploymentJornadaPolicy_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);

CREATE TABLE "WorkforceOvertimeCalculation" (
  "id" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "timesheetVersion" INTEGER NOT NULL,
  "timesheetApprovedAt" TIMESTAMP(3) NOT NULL,
  "approvedMinutes" INTEGER NOT NULL,
  "ordinaryMinutes" INTEGER NOT NULL,
  "doubleMinutes" INTEGER NOT NULL,
  "tripleMinutes" INTEGER NOT NULL,
  "weeklyDoubleLimitMinutes" INTEGER NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "workforcePolicyVersionId" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "status" "WorkforceOvertimeCalculationStatus" NOT NULL DEFAULT 'FINAL',
  "calculatedById" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkforceOvertimeCalculation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkforceOvertimeCalculation_minutes_check" CHECK (
    "approvedMinutes" >= 0 AND "ordinaryMinutes" >= 0 AND
    "doubleMinutes" >= 0 AND "tripleMinutes" >= 0 AND
    "weeklyDoubleLimitMinutes" >= 0 AND
    "ordinaryMinutes" + "doubleMinutes" + "tripleMinutes" = "approvedMinutes"
  )
);

CREATE TABLE "WorkforceOvertimeLine" (
  "id" TEXT NOT NULL,
  "calculationId" TEXT NOT NULL,
  "timesheetLineId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "jornadaType" "WorkforceJornadaType" NOT NULL,
  "ordinaryLimitMinutes" INTEGER NOT NULL,
  "approvedMinutes" INTEGER NOT NULL,
  "ordinaryMinutes" INTEGER NOT NULL,
  "doubleMinutes" INTEGER NOT NULL,
  "tripleMinutes" INTEGER NOT NULL,
  "weeklyOvertimeBeforeMinutes" INTEGER NOT NULL,
  "remainingDoubleBeforeMinutes" INTEGER NOT NULL,
  "explanation" TEXT NOT NULL,
  CONSTRAINT "WorkforceOvertimeLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkforceOvertimeLine_minutes_check" CHECK (
    "ordinaryLimitMinutes" > 0 AND "approvedMinutes" >= 0 AND
    "ordinaryMinutes" >= 0 AND "doubleMinutes" >= 0 AND "tripleMinutes" >= 0 AND
    "weeklyOvertimeBeforeMinutes" >= 0 AND "remainingDoubleBeforeMinutes" >= 0 AND
    "ordinaryMinutes" + "doubleMinutes" + "tripleMinutes" = "approvedMinutes"
  )
);

CREATE INDEX "EmploymentJornadaPolicy_employmentId_effectiveFrom_effectiveTo_idx" ON "EmploymentJornadaPolicy"("employmentId", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "WorkforceOvertimeCalculation_timesheetId_key" ON "WorkforceOvertimeCalculation"("timesheetId");
CREATE INDEX "WorkforceOvertimeCalculation_status_calculatedAt_idx" ON "WorkforceOvertimeCalculation"("status", "calculatedAt");
CREATE UNIQUE INDEX "WorkforceOvertimeLine_calculationId_businessDate_key" ON "WorkforceOvertimeLine"("calculationId", "businessDate");
CREATE INDEX "WorkforceOvertimeLine_timesheetLineId_idx" ON "WorkforceOvertimeLine"("timesheetLineId");

ALTER TABLE "EmploymentJornadaPolicy" ADD CONSTRAINT "EmploymentJornadaPolicy_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceOvertimeCalculation" ADD CONSTRAINT "WorkforceOvertimeCalculation_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceOvertimeCalculation" ADD CONSTRAINT "WorkforceOvertimeCalculation_workforcePolicyVersionId_fkey" FOREIGN KEY ("workforcePolicyVersionId") REFERENCES "WorkforcePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceOvertimeCalculation" ADD CONSTRAINT "WorkforceOvertimeCalculation_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceOvertimeLine" ADD CONSTRAINT "WorkforceOvertimeLine_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "WorkforceOvertimeCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceOvertimeLine" ADD CONSTRAINT "WorkforceOvertimeLine_timesheetLineId_fkey" FOREIGN KEY ("timesheetLineId") REFERENCES "TimesheetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
