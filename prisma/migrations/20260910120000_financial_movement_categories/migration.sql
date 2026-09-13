-- Global administrable taxonomy for manual cash and envelope movements.
-- Additive only: legacy rows remain valid and no historical data is rewritten.
CREATE TYPE "FinancialMovementDirection" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialMovementScope" AS ENUM ('CASH', 'ENVELOPE', 'BOTH');

CREATE TABLE "FinancialMovementCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction" "FinancialMovementDirection" NOT NULL,
    "scope" "FinancialMovementScope" NOT NULL,
    "group" TEXT,
    "requiresReason" BOOLEAN NOT NULL DEFAULT false,
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "FinancialMovementCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialMovementCategory_code_key" ON "FinancialMovementCategory"("code");
CREATE INDEX "FinancialMovementCategory_direction_scope_isActive_sortOrder_idx" ON "FinancialMovementCategory"("direction", "scope", "isActive", "sortOrder");
CREATE INDEX "FinancialMovementCategory_isActive_name_idx" ON "FinancialMovementCategory"("isActive", "name");
ALTER TABLE "FinancialMovementCategory" ADD CONSTRAINT "FinancialMovementCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialMovementCategory" ADD CONSTRAINT "FinancialMovementCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutflow" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "CashOutflow" ADD COLUMN "categoryNameSnapshot" TEXT;
ALTER TABLE "CashInflow" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "CashInflow" ADD COLUMN "categoryNameSnapshot" TEXT;
ALTER TABLE "CashInflow" ADD COLUMN "receiptPhotoUrl" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "categoryNameSnapshot" TEXT;
ALTER TABLE "CashSafeEnvelopeMovement" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "CashSafeEnvelopeMovement" ADD COLUMN "receiptPhotoUrl" TEXT;
ALTER TABLE "CashSafeEnvelopeMovement" ADD COLUMN "categoryNameSnapshot" TEXT;

ALTER TABLE "CashOutflow" ADD CONSTRAINT "CashOutflow_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialMovementCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashInflow" ADD CONSTRAINT "CashInflow_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialMovementCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialMovementCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSafeEnvelopeMovement" ADD CONSTRAINT "CashSafeEnvelopeMovement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialMovementCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CashOutflow_categoryId_idx" ON "CashOutflow"("categoryId");
CREATE INDEX "CashInflow_categoryId_idx" ON "CashInflow"("categoryId");
CREATE INDEX "CashMovement_categoryId_idx" ON "CashMovement"("categoryId");
CREATE INDEX "CashSafeEnvelopeMovement_categoryId_idx" ON "CashSafeEnvelopeMovement"("categoryId");

-- Initial editable defaults. They are ordinary catalog rows: administrators
-- may rename, reorder or deactivate them after installation.
INSERT INTO "FinancialMovementCategory" ("id", "name", "code", "direction", "scope", "sortOrder", "updatedAt") VALUES
  ('financial-category-rent', 'Pago de renta', 'PAGO_RENTA', 'EXPENSE', 'BOTH', 10, CURRENT_TIMESTAMP),
  ('financial-category-electricity', 'Pago de luz', 'PAGO_LUZ', 'EXPENSE', 'BOTH', 20, CURRENT_TIMESTAMP),
  ('financial-category-water', 'Pago de agua', 'PAGO_AGUA', 'EXPENSE', 'BOTH', 30, CURRENT_TIMESTAMP),
  ('financial-category-cleaning', 'Limpieza', 'LIMPIEZA', 'EXPENSE', 'BOTH', 40, CURRENT_TIMESTAMP),
  ('financial-category-payroll', 'Nómina', 'NOMINA', 'EXPENSE', 'BOTH', 50, CURRENT_TIMESTAMP),
  ('financial-category-supplies', 'Compra de insumos', 'COMPRA_INSUMOS', 'EXPENSE', 'BOTH', 60, CURRENT_TIMESTAMP),
  ('financial-category-maintenance', 'Mantenimiento', 'MANTENIMIENTO', 'EXPENSE', 'BOTH', 70, CURRENT_TIMESTAMP),
  ('financial-category-other-income', 'Otros ingresos', 'OTROS_INGRESOS', 'INCOME', 'BOTH', 80, CURRENT_TIMESTAMP);
