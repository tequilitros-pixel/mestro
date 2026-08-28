-- Attendance V1 uses additive enum values and an auditable derivation identity.
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'LATE_ARRIVAL';
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'MISSING_CLOCK_IN';
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'MISSING_CLOCK_OUT';
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'INCOMPLETE_BREAK';
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'LONG_BREAK';
ALTER TYPE "AttendanceExceptionSeverity" ADD VALUE IF NOT EXISTS 'CRITICAL';

ALTER TABLE "AttendanceException"
  ADD COLUMN "branchId" TEXT NOT NULL,
  ADD COLUMN "businessDate" DATE NOT NULL,
  ADD COLUMN "derivationKey" TEXT NOT NULL,
  ADD COLUMN "fingerprint" TEXT NOT NULL,
  ADD COLUMN "derivationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "scheduledStart" TIMESTAMP(3),
  ADD COLUMN "scheduledEnd" TIMESTAMP(3),
  ADD COLUMN "actualStart" TIMESTAMP(3),
  ADD COLUMN "actualEnd" TIMESTAMP(3),
  ADD COLUMN "differenceMinutes" INTEGER,
  ADD COLUMN "policySnapshot" JSONB NOT NULL,
  ADD COLUMN "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "AttendanceException_fingerprint_key" ON "AttendanceException"("fingerprint");
CREATE INDEX "AttendanceException_branchId_businessDate_status_idx" ON "AttendanceException"("branchId", "businessDate", "status");
CREATE INDEX "AttendanceException_derivationKey_idx" ON "AttendanceException"("derivationKey");
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
