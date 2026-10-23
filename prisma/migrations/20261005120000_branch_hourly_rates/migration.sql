ALTER TABLE "SalaryRate" ADD COLUMN "branchId" TEXT;

CREATE INDEX "SalaryRate_userId_branchId_effectiveFrom_idx"
  ON "SalaryRate"("userId", "branchId", "effectiveFrom");

ALTER TABLE "SalaryRate" ADD CONSTRAINT "SalaryRate_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
