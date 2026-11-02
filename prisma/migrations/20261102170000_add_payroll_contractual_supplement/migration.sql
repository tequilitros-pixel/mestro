-- Configuración opcional y fechada por empleado; no modifica nóminas históricas.
CREATE TABLE "PayrollSupplementRate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "percent" DECIMAL(5,2) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollSupplementRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayrollSupplementRate_userId_effectiveFrom_idx" ON "PayrollSupplementRate"("userId", "effectiveFrom");
ALTER TABLE "PayrollSupplementRate" ADD CONSTRAINT "PayrollSupplementRate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollSupplementRate" ADD CONSTRAINT "PayrollSupplementRate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
