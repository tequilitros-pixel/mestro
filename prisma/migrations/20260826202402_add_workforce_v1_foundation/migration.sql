-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "DataConfidence" AS ENUM ('KNOWN', 'LEGACY_UNKNOWN', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "WorkforceRateType" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'SALARY');

-- CreateEnum
CREATE TYPE "BranchAssignmentType" AS ENUM ('HOME', 'ALLOWED');

-- CreateEnum
CREATE TYPE "WorkforceAvailabilityExceptionType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SchedulePeriodStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkforceShiftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClockEventType" AS ENUM ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "ClockCorrectionType" AS ENUM ('MODIFY_OCCURRED_TIME', 'ADD_MISSING_EVENT', 'VOID_EVENT');

-- CreateEnum
CREATE TYPE "WorkforceDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkSessionStatus" AS ENUM ('OPEN', 'COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "AttendanceExceptionType" AS ENUM ('LATE', 'EARLY_DEPARTURE', 'MISSING_PUNCH', 'NO_SHOW', 'UNSCHEDULED_WORK', 'OVERTIME', 'BREAK_ANOMALY');

-- CreateEnum
CREATE TYPE "AttendanceExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('OPEN', 'REVIEW', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "TimesheetAdjustmentType" AS ENUM ('ADD_PAYABLE_TIME', 'REMOVE_PAYABLE_TIME', 'RECLASSIFY_TIME');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "employeeNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "dataConfidence" "DataConfidence" NOT NULL DEFAULT 'KNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRate" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "rateType" "WorkforceRateType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchAssignment" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "BranchAssignmentType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "WorkforceAvailabilityExceptionType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePeriod" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "SchedulePeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "schedulePeriodId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "expectedBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkforceShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRevision" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "employmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "expectedBreakMinutes" INTEGER NOT NULL,
    "status" "WorkforceShiftStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePublication" (
    "id" TEXT NOT NULL,
    "schedulePeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePublicationShift" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftRevisionId" TEXT NOT NULL,

    CONSTRAINT "SchedulePublicationShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockEvent" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "ClockEventType" NOT NULL,
    "deviceOccurredAt" TIMESTAMP(3) NOT NULL,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "deviceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockCorrection" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "targetClockEventId" TEXT,
    "type" "ClockCorrectionType" NOT NULL,
    "proposedEventType" "ClockEventType",
    "proposedOccurredAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "WorkforceDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shiftId" TEXT,
    "businessDate" DATE NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "reconstructionVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkSessionStatus" NOT NULL,
    "reconstructedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSessionClockEvent" (
    "id" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "clockEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "WorkSessionClockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "shiftId" TEXT,
    "workSessionId" TEXT,
    "type" "AttendanceExceptionType" NOT NULL,
    "severity" "AttendanceExceptionSeverity" NOT NULL,
    "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetLine" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "adjustmentMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularPayableMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeTier1Minutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeTier2Minutes" INTEGER NOT NULL DEFAULT 0,
    "totalPayableMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetLineWorkSession" (
    "id" TEXT NOT NULL,
    "timesheetLineId" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,

    CONSTRAINT "TimesheetLineWorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetAdjustment" (
    "id" TEXT NOT NULL,
    "timesheetLineId" TEXT NOT NULL,
    "type" "TimesheetAdjustmentType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "WorkforceDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "TimesheetAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "rateTypeSnapshot" "WorkforceRateType" NOT NULL,
    "payRateAmountSnapshot" DECIMAL(12,2) NOT NULL,
    "currencySnapshot" CHAR(3) NOT NULL,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeTier1Minutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeTier2Minutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeTier1Multiplier" DECIMAL(5,2) NOT NULL,
    "overtimeTier2Multiplier" DECIMAL(5,2) NOT NULL,
    "adjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforcePayrollAdjustment" (
    "id" TEXT NOT NULL,
    "originalPayrollLineId" TEXT NOT NULL,
    "appliedPayrollPeriodId" TEXT NOT NULL,
    "minutes" INTEGER,
    "amount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "status" "WorkforceDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "WorkforcePayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_active_idx" ON "Employee"("active");

-- CreateIndex
CREATE INDEX "Employment_employeeId_status_idx" ON "Employment"("employeeId", "status");

-- CreateIndex
CREATE INDEX "PayRate_employmentId_effectiveFrom_idx" ON "PayRate"("employmentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "BranchAssignment_employmentId_effectiveFrom_effectiveTo_idx" ON "BranchAssignment"("employmentId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "BranchAssignment_branchId_effectiveFrom_effectiveTo_idx" ON "BranchAssignment"("branchId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "AvailabilityRule_employmentId_effectiveFrom_idx" ON "AvailabilityRule"("employmentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AvailabilityRule_employmentId_dayOfWeek_idx" ON "AvailabilityRule"("employmentId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_employmentId_date_key" ON "AvailabilityException"("employmentId", "date");

-- CreateIndex
CREATE INDEX "SchedulePeriod_branchId_status_idx" ON "SchedulePeriod"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePeriod_branchId_periodStart_periodEnd_key" ON "SchedulePeriod"("branchId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Shift_branchId_startAt_idx" ON "Shift"("branchId", "startAt");

-- CreateIndex
CREATE INDEX "Shift_employmentId_startAt_idx" ON "Shift"("employmentId", "startAt");

-- CreateIndex
CREATE INDEX "Shift_businessDate_idx" ON "Shift"("businessDate");

-- CreateIndex
CREATE INDEX "Shift_schedulePeriodId_idx" ON "Shift"("schedulePeriodId");

-- CreateIndex
CREATE INDEX "ShiftRevision_employmentId_startAt_idx" ON "ShiftRevision"("employmentId", "startAt");

-- CreateIndex
CREATE INDEX "ShiftRevision_branchId_startAt_idx" ON "ShiftRevision"("branchId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRevision_shiftId_revisionNumber_key" ON "ShiftRevision"("shiftId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePublication_schedulePeriodId_version_key" ON "SchedulePublication"("schedulePeriodId", "version");

-- CreateIndex
CREATE INDEX "SchedulePublicationShift_shiftRevisionId_idx" ON "SchedulePublicationShift"("shiftRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePublicationShift_publicationId_shiftId_key" ON "SchedulePublicationShift"("publicationId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ClockEvent_idempotencyKey_key" ON "ClockEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ClockEvent_employmentId_deviceOccurredAt_idx" ON "ClockEvent"("employmentId", "deviceOccurredAt");

-- CreateIndex
CREATE INDEX "ClockEvent_branchId_serverReceivedAt_idx" ON "ClockEvent"("branchId", "serverReceivedAt");

-- CreateIndex
CREATE INDEX "ClockCorrection_employmentId_requestedAt_idx" ON "ClockCorrection"("employmentId", "requestedAt");

-- CreateIndex
CREATE INDEX "ClockCorrection_targetClockEventId_idx" ON "ClockCorrection"("targetClockEventId");

-- CreateIndex
CREATE INDEX "ClockCorrection_status_idx" ON "ClockCorrection"("status");

-- CreateIndex
CREATE INDEX "WorkSession_employmentId_businessDate_idx" ON "WorkSession"("employmentId", "businessDate");

-- CreateIndex
CREATE INDEX "WorkSession_branchId_businessDate_idx" ON "WorkSession"("branchId", "businessDate");

-- CreateIndex
CREATE INDEX "WorkSession_shiftId_idx" ON "WorkSession"("shiftId");

-- CreateIndex
CREATE INDEX "WorkSessionClockEvent_clockEventId_idx" ON "WorkSessionClockEvent"("clockEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSessionClockEvent_workSessionId_clockEventId_key" ON "WorkSessionClockEvent"("workSessionId", "clockEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSessionClockEvent_workSessionId_sequence_key" ON "WorkSessionClockEvent"("workSessionId", "sequence");

-- CreateIndex
CREATE INDEX "AttendanceException_status_type_idx" ON "AttendanceException"("status", "type");

-- CreateIndex
CREATE INDEX "AttendanceException_employmentId_detectedAt_idx" ON "AttendanceException"("employmentId", "detectedAt");

-- CreateIndex
CREATE INDEX "AttendanceException_shiftId_idx" ON "AttendanceException"("shiftId");

-- CreateIndex
CREATE INDEX "AttendanceException_workSessionId_idx" ON "AttendanceException"("workSessionId");

-- CreateIndex
CREATE INDEX "Timesheet_employmentId_periodStart_idx" ON "Timesheet"("employmentId", "periodStart");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_employmentId_periodStart_periodEnd_key" ON "Timesheet"("employmentId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetLine_timesheetId_businessDate_key" ON "TimesheetLine"("timesheetId", "businessDate");

-- CreateIndex
CREATE INDEX "TimesheetLineWorkSession_workSessionId_idx" ON "TimesheetLineWorkSession"("workSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetLineWorkSession_timesheetLineId_workSessionId_key" ON "TimesheetLineWorkSession"("timesheetLineId", "workSessionId");

-- CreateIndex
CREATE INDEX "TimesheetAdjustment_timesheetLineId_status_idx" ON "TimesheetAdjustment"("timesheetLineId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_timesheetId_key" ON "PayrollLine"("timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLine_payrollPeriodId_employmentId_key" ON "PayrollLine"("payrollPeriodId", "employmentId");

-- CreateIndex
CREATE INDEX "WorkforcePayrollAdjustment_originalPayrollLineId_idx" ON "WorkforcePayrollAdjustment"("originalPayrollLineId");

-- CreateIndex
CREATE INDEX "WorkforcePayrollAdjustment_appliedPayrollPeriodId_status_idx" ON "WorkforcePayrollAdjustment"("appliedPayrollPeriodId", "status");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAssignment" ADD CONSTRAINT "BranchAssignment_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchAssignment" ADD CONSTRAINT "BranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_schedulePeriodId_fkey" FOREIGN KEY ("schedulePeriodId") REFERENCES "SchedulePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRevision" ADD CONSTRAINT "ShiftRevision_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRevision" ADD CONSTRAINT "ShiftRevision_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRevision" ADD CONSTRAINT "ShiftRevision_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRevision" ADD CONSTRAINT "ShiftRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublication" ADD CONSTRAINT "SchedulePublication_schedulePeriodId_fkey" FOREIGN KEY ("schedulePeriodId") REFERENCES "SchedulePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublication" ADD CONSTRAINT "SchedulePublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublicationShift" ADD CONSTRAINT "SchedulePublicationShift_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "SchedulePublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublicationShift" ADD CONSTRAINT "SchedulePublicationShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePublicationShift" ADD CONSTRAINT "SchedulePublicationShift_shiftRevisionId_fkey" FOREIGN KEY ("shiftRevisionId") REFERENCES "ShiftRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockEvent" ADD CONSTRAINT "ClockEvent_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockEvent" ADD CONSTRAINT "ClockEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_targetClockEventId_fkey" FOREIGN KEY ("targetClockEventId") REFERENCES "ClockEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSessionClockEvent" ADD CONSTRAINT "WorkSessionClockEvent_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSessionClockEvent" ADD CONSTRAINT "WorkSessionClockEvent_clockEventId_fkey" FOREIGN KEY ("clockEventId") REFERENCES "ClockEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetLine" ADD CONSTRAINT "TimesheetLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetLineWorkSession" ADD CONSTRAINT "TimesheetLineWorkSession_timesheetLineId_fkey" FOREIGN KEY ("timesheetLineId") REFERENCES "TimesheetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetLineWorkSession" ADD CONSTRAINT "TimesheetLineWorkSession_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetAdjustment" ADD CONSTRAINT "TimesheetAdjustment_timesheetLineId_fkey" FOREIGN KEY ("timesheetLineId") REFERENCES "TimesheetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetAdjustment" ADD CONSTRAINT "TimesheetAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetAdjustment" ADD CONSTRAINT "TimesheetAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "Employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforcePayrollAdjustment" ADD CONSTRAINT "WorkforcePayrollAdjustment_originalPayrollLineId_fkey" FOREIGN KEY ("originalPayrollLineId") REFERENCES "PayrollLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforcePayrollAdjustment" ADD CONSTRAINT "WorkforcePayrollAdjustment_appliedPayrollPeriodId_fkey" FOREIGN KEY ("appliedPayrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforcePayrollAdjustment" ADD CONSTRAINT "WorkforcePayrollAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforcePayrollAdjustment" ADD CONSTRAINT "WorkforcePayrollAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe structural invariants. Workflow immutability and temporal HOME
-- assignment exclusion remain deferred until their services are designed.
ALTER TABLE "Employment"
    ADD CONSTRAINT "Employment_effective_range_check"
    CHECK ("endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "PayRate"
    ADD CONSTRAINT "PayRate_effective_range_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "BranchAssignment"
    ADD CONSTRAINT "BranchAssignment_effective_range_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "AvailabilityRule"
    ADD CONSTRAINT "AvailabilityRule_day_of_week_check"
    CHECK ("dayOfWeek" BETWEEN 0 AND 6),
    ADD CONSTRAINT "AvailabilityRule_effective_range_check"
    CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" >= "effectiveFrom");

ALTER TABLE "SchedulePeriod"
    ADD CONSTRAINT "SchedulePeriod_range_check"
    CHECK ("periodEnd" >= "periodStart"),
    ADD CONSTRAINT "SchedulePeriod_version_check"
    CHECK ("version" > 0);

ALTER TABLE "Shift"
    ADD CONSTRAINT "Shift_time_range_check"
    CHECK ("endAt" > "startAt"),
    ADD CONSTRAINT "Shift_break_minutes_check"
    CHECK ("expectedBreakMinutes" >= 0),
    ADD CONSTRAINT "Shift_version_check"
    CHECK ("version" > 0);

ALTER TABLE "ShiftRevision"
    ADD CONSTRAINT "ShiftRevision_time_range_check"
    CHECK ("endAt" > "startAt"),
    ADD CONSTRAINT "ShiftRevision_break_minutes_check"
    CHECK ("expectedBreakMinutes" >= 0),
    ADD CONSTRAINT "ShiftRevision_number_check"
    CHECK ("revisionNumber" > 0);

ALTER TABLE "SchedulePublication"
    ADD CONSTRAINT "SchedulePublication_version_check"
    CHECK ("version" > 0);

ALTER TABLE "WorkSession"
    ADD CONSTRAINT "WorkSession_time_range_check"
    CHECK ("endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt"),
    ADD CONSTRAINT "WorkSession_minutes_check"
    CHECK ("workedMinutes" >= 0 AND "breakMinutes" >= 0),
    ADD CONSTRAINT "WorkSession_reconstruction_version_check"
    CHECK ("reconstructionVersion" > 0);

ALTER TABLE "WorkSessionClockEvent"
    ADD CONSTRAINT "WorkSessionClockEvent_sequence_check"
    CHECK ("sequence" >= 0);

ALTER TABLE "Timesheet"
    ADD CONSTRAINT "Timesheet_range_check"
    CHECK ("periodEnd" >= "periodStart"),
    ADD CONSTRAINT "Timesheet_version_check"
    CHECK ("version" > 0);

ALTER TABLE "TimesheetLine"
    ADD CONSTRAINT "TimesheetLine_minutes_check"
    CHECK (
        "workedMinutes" >= 0
        AND "regularPayableMinutes" >= 0
        AND "overtimeTier1Minutes" >= 0
        AND "overtimeTier2Minutes" >= 0
        AND "totalPayableMinutes" >= 0
    );

ALTER TABLE "PayrollLine"
    ADD CONSTRAINT "PayrollLine_minutes_check"
    CHECK (
        "regularMinutes" >= 0
        AND "overtimeTier1Minutes" >= 0
        AND "overtimeTier2Minutes" >= 0
    ),
    ADD CONSTRAINT "PayrollLine_multipliers_check"
    CHECK ("overtimeTier1Multiplier" >= 0 AND "overtimeTier2Multiplier" >= 0);
