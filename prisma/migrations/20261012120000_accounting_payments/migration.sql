-- Registro independiente de pagos administrativos. No modifica movimientos existentes.
CREATE TYPE "AccountingPaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'OTRO');

-- Categorías de pagos en el catálogo financiero administrable existente.
INSERT INTO "FinancialMovementCategory" ("id", "name", "code", "direction", "scope", "sortOrder", "updatedAt") VALUES
  ('accounting-rent', 'Renta', 'CONT_RENTA', 'EXPENSE', 'ACCOUNTING', 10, CURRENT_TIMESTAMP),
  ('accounting-electricity', 'Luz', 'CONT_LUZ', 'EXPENSE', 'ACCOUNTING', 20, CURRENT_TIMESTAMP),
  ('accounting-water', 'Agua', 'CONT_AGUA', 'EXPENSE', 'ACCOUNTING', 30, CURRENT_TIMESTAMP),
  ('accounting-suppliers', 'Proveedores', 'CONT_PROVEEDORES', 'EXPENSE', 'ACCOUNTING', 40, CURRENT_TIMESTAMP),
  ('accounting-inventory', 'Inventario', 'CONT_INVENTARIO', 'EXPENSE', 'ACCOUNTING', 50, CURRENT_TIMESTAMP),
  ('accounting-payroll', 'Nómina', 'CONT_NOMINA', 'EXPENSE', 'ACCOUNTING', 60, CURRENT_TIMESTAMP),
  ('accounting-maintenance', 'Mantenimiento', 'CONT_MANTENIMIENTO', 'EXPENSE', 'ACCOUNTING', 70, CURRENT_TIMESTAMP),
  ('accounting-services', 'Otros servicios', 'CONT_SERVICIOS', 'EXPENSE', 'ACCOUNTING', 80, CURRENT_TIMESTAMP),
  ('accounting-taxes', 'Impuestos', 'CONT_IMPUESTOS', 'EXPENSE', 'ACCOUNTING', 90, CURRENT_TIMESTAMP),
  ('accounting-other', 'Otros pagos', 'CONT_OTROS', 'EXPENSE', 'ACCOUNTING', 100, CURRENT_TIMESTAMP);

CREATE TABLE "AccountingPayment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "branchNameSnapshot" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryNameSnapshot" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "AccountingPaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    CONSTRAINT "AccountingPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingPayment_positive_amount" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "AccountingPayment_requestId_key" ON "AccountingPayment"("requestId");
CREATE INDEX "AccountingPayment_branchId_paymentDate_idx" ON "AccountingPayment"("branchId", "paymentDate");
CREATE INDEX "AccountingPayment_paymentDate_idx" ON "AccountingPayment"("paymentDate");
CREATE INDEX "AccountingPayment_categoryId_paymentDate_idx" ON "AccountingPayment"("categoryId", "paymentDate");
CREATE INDEX "AccountingPayment_voidedAt_idx" ON "AccountingPayment"("voidedAt");

ALTER TABLE "AccountingPayment" ADD CONSTRAINT "AccountingPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPayment" ADD CONSTRAINT "AccountingPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialMovementCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPayment" ADD CONSTRAINT "AccountingPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPayment" ADD CONSTRAINT "AccountingPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
