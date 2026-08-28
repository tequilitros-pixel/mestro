-- Timesheet V1 approval snapshots, PayrollPeriod linkage, and idempotency.
-- DEV preflight confirmed all Workforce Timesheet tables are empty.
ALTER TABLE "Timesheet"
  ADD COLUMN "payrollPeriodId" TEXT NOT NULL,
  ADD COLUMN "baseWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "adjustmentMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "effectiveMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sourceFingerprint" TEXT NOT NULL,
  ADD COLUMN "approvedSourceFingerprint" TEXT,
  ADD COLUMN "approvedBaseMinutes" INTEGER,
  ADD COLUMN "approvedAdjustmentMinutes" INTEGER,
  ADD COLUMN "approvedEffectiveMinutes" INTEGER,
  ADD COLUMN "approvedIssuesSnapshot" JSONB,
  ADD COLUMN "requiresAdjustment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "approvalIdempotencyKey" TEXT,
  ADD COLUMN "lockedById" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3);

ALTER TABLE "TimesheetLine"
  ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sessionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scheduledMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "attendanceIssueCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceFingerprint" TEXT NOT NULL;

ALTER TABLE "TimesheetAdjustment" ADD COLUMN "idempotencyKey" TEXT NOT NULL;

CREATE UNIQUE INDEX "Timesheet_employmentId_payrollPeriodId_key" ON "Timesheet"("employmentId", "payrollPeriodId");
CREATE UNIQUE INDEX "Timesheet_approvalIdempotencyKey_key" ON "Timesheet"("approvalIdempotencyKey");
CREATE UNIQUE INDEX "TimesheetAdjustment_idempotencyKey_key" ON "TimesheetAdjustment"("idempotencyKey");
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
