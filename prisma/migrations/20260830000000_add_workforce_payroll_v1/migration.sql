-- Workforce Payroll V1. Additive only; legacy PayrollEntry/PayrollAdjustment remain untouched.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PayrollLine") OR EXISTS (SELECT 1 FROM "WorkforcePayrollAdjustment") THEN
    RAISE EXCEPTION 'PAYROLL_V1_MIGRATION_REQUIRES_EMPTY_WORKFORCE_SKELETONS';
  END IF;
END $$;

CREATE TYPE "WorkforcePayrollLineStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'PAID');
CREATE TYPE "WorkforcePayrollAdjustmentDirection" AS ENUM ('EARNING', 'DEDUCTION');
CREATE TYPE "WorkforcePayrollAdjustmentKind" AS ENUM ('EARNING', 'DEDUCTION', 'RETROACTIVE');

ALTER TABLE "PayrollLine" ADD COLUMN "approvalIdempotencyKey" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3), ADD COLUMN "approvedById" TEXT,
ADD COLUMN "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deductionsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "doublePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "earningsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "operationalPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "ordinaryPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "overtimeCalculationId" TEXT NOT NULL,
ADD COLUMN "overtimePolicyVersion" TEXT NOT NULL,
ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "paidById" TEXT,
ADD COLUMN "paymentIdempotencyKey" TEXT, ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "sourceFingerprint" TEXT NOT NULL,
ADD COLUMN "status" "WorkforcePayrollLineStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "timesheetVersion" INTEGER NOT NULL,
ADD COLUMN "triplePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "WorkforcePayrollAdjustment" ADD COLUMN "idempotencyKey" TEXT NOT NULL,
ADD COLUMN "kind" "WorkforcePayrollAdjustmentKind" NOT NULL DEFAULT 'RETROACTIVE';

CREATE TABLE "WorkforcePayrollRateSegment" (
  "id" TEXT NOT NULL, "payrollLineId" TEXT NOT NULL, "payRateId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL, "rateType" "WorkforceRateType" NOT NULL,
  "hourlyRate" DECIMAL(12,2) NOT NULL, "currency" CHAR(3) NOT NULL,
  "ordinaryMinutes" INTEGER NOT NULL, "doubleMinutes" INTEGER NOT NULL, "tripleMinutes" INTEGER NOT NULL,
  "ordinaryPay" DECIMAL(12,2) NOT NULL, "doublePay" DECIMAL(12,2) NOT NULL, "triplePay" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "WorkforcePayrollRateSegment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkforcePayrollRateSegment_values_check" CHECK (
    "ordinaryMinutes" >= 0 AND "doubleMinutes" >= 0 AND "tripleMinutes" >= 0 AND
    "hourlyRate" > 0 AND "ordinaryPay" >= 0 AND "doublePay" >= 0 AND "triplePay" >= 0)
);
CREATE TABLE "WorkforcePayrollCategory" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "direction" "WorkforcePayrollAdjustmentDirection" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkforcePayrollCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkforcePayrollLineAdjustment" (
  "id" TEXT NOT NULL, "payrollLineId" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL, "direction" "WorkforcePayrollAdjustmentDirection" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "reason" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "WorkforcePayrollLineAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkforcePayrollLineAdjustment_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "WorkforcePayrollRateSegment_payRateId_idx" ON "WorkforcePayrollRateSegment"("payRateId");
CREATE UNIQUE INDEX "WorkforcePayrollRateSegment_payrollLineId_businessDate_key" ON "WorkforcePayrollRateSegment"("payrollLineId", "businessDate");
CREATE INDEX "WorkforcePayrollCategory_active_direction_idx" ON "WorkforcePayrollCategory"("active", "direction");
CREATE UNIQUE INDEX "WorkforcePayrollCategory_name_direction_key" ON "WorkforcePayrollCategory"("name", "direction");
CREATE UNIQUE INDEX "WorkforcePayrollLineAdjustment_idempotencyKey_key" ON "WorkforcePayrollLineAdjustment"("idempotencyKey");
CREATE INDEX "WorkforcePayrollLineAdjustment_payrollLineId_direction_idx" ON "WorkforcePayrollLineAdjustment"("payrollLineId", "direction");
CREATE UNIQUE INDEX "PayrollLine_approvalIdempotencyKey_key" ON "PayrollLine"("approvalIdempotencyKey");
CREATE UNIQUE INDEX "PayrollLine_paymentIdempotencyKey_key" ON "PayrollLine"("paymentIdempotencyKey");
CREATE UNIQUE INDEX "WorkforcePayrollAdjustment_idempotencyKey_key" ON "WorkforcePayrollAdjustment"("idempotencyKey");

ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_overtimeCalculationId_fkey" FOREIGN KEY ("overtimeCalculationId") REFERENCES "WorkforceOvertimeCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforcePayrollRateSegment" ADD CONSTRAINT "WorkforcePayrollRateSegment_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforcePayrollCategory" ADD CONSTRAINT "WorkforcePayrollCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforcePayrollLineAdjustment" ADD CONSTRAINT "WorkforcePayrollLineAdjustment_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforcePayrollLineAdjustment" ADD CONSTRAINT "WorkforcePayrollLineAdjustment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WorkforcePayrollCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforcePayrollLineAdjustment" ADD CONSTRAINT "WorkforcePayrollLineAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_money_check" CHECK (
  "ordinaryPay" >= 0 AND "doublePay" >= 0 AND "triplePay" >= 0 AND
  "earningsAmount" >= 0 AND "deductionsAmount" >= 0 AND "grossAmount" >= 0 AND "operationalPayable" >= 0);

INSERT INTO "WorkforcePayrollCategory" ("id", "name", "direction", "active", "updatedAt") VALUES
('workforce_payroll_category_bonus', 'Bono', 'EARNING', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_commission', 'Comisión', 'EARNING', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_attendance', 'Bono de asistencia', 'EARNING', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_other_earning', 'Otro ingreso', 'EARNING', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_advance', 'Anticipo / préstamo', 'DEDUCTION', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_uniform', 'Uniforme', 'DEDUCTION', true, CURRENT_TIMESTAMP),
('workforce_payroll_category_other_deduction', 'Otra deducción autorizada', 'DEDUCTION', true, CURRENT_TIMESTAMP);
