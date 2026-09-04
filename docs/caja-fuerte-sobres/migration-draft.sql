-- ============================================================
-- BORRADOR de referencia -- NO ES LA MIGRACION REAL.
-- ============================================================
-- Cuando el schema se libere, la migracion real se genera con
-- `npx prisma migrate dev --name add_cash_safe_envelopes` a partir
-- de schema-additions.prisma. Este archivo es solo para revisar
-- de antemano que el cambio es 100% aditivo: CREATE TYPE y CREATE
-- TABLE nuevos, cero ALTER sobre tablas existentes, cero DROP,
-- cero perdida de datos.

CREATE TYPE "CashSafeEnvelopeStatus" AS ENUM (
  'PENDIENTE',
  'EN_CAJA_FUERTE',
  'PARCIAL',
  'VACIO'
);

CREATE TYPE "CashSafeEnvelopeMovementType" AS ENUM (
  'INGRESO',
  'RECEPCION',
  'RETIRO',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO'
);

CREATE TABLE "CashSafeEnvelope" (
  "id"              TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "branchId"        TEXT NOT NULL,
  "cashCutId"       TEXT NOT NULL,
  "cutDate"         TIMESTAMP(3) NOT NULL,
  "originalAmount"  DOUBLE PRECISION NOT NULL,
  "currentBalance"  DOUBLE PRECISION NOT NULL,
  "status"          "CashSafeEnvelopeStatus" NOT NULL DEFAULT 'PENDIENTE',
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedById"    TEXT,
  "receivedAt"      TIMESTAMP(3),
  "receivedAmount"  DOUBLE PRECISION,

  CONSTRAINT "CashSafeEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashSafeEnvelope_code_key" ON "CashSafeEnvelope"("code");
CREATE UNIQUE INDEX "CashSafeEnvelope_cashCutId_key" ON "CashSafeEnvelope"("cashCutId");
CREATE INDEX "CashSafeEnvelope_branchId_idx" ON "CashSafeEnvelope"("branchId");
CREATE INDEX "CashSafeEnvelope_status_idx" ON "CashSafeEnvelope"("status");
CREATE INDEX "CashSafeEnvelope_cutDate_idx" ON "CashSafeEnvelope"("cutDate");

ALTER TABLE "CashSafeEnvelope"
  ADD CONSTRAINT "CashSafeEnvelope_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSafeEnvelope"
  ADD CONSTRAINT "CashSafeEnvelope_cashCutId_fkey"
  FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSafeEnvelope"
  ADD CONSTRAINT "CashSafeEnvelope_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSafeEnvelope"
  ADD CONSTRAINT "CashSafeEnvelope_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashSafeEnvelopeMovement" (
  "id"              TEXT NOT NULL,
  "envelopeId"      TEXT NOT NULL,
  "type"            "CashSafeEnvelopeMovementType" NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "previousBalance" DOUBLE PRECISION NOT NULL,
  "newBalance"      DOUBLE PRECISION NOT NULL,
  "notes"           TEXT,
  "cashCutId"       TEXT,
  "userId"          TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashSafeEnvelopeMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashSafeEnvelopeMovement_envelopeId_idx" ON "CashSafeEnvelopeMovement"("envelopeId");
CREATE INDEX "CashSafeEnvelopeMovement_cashCutId_idx" ON "CashSafeEnvelopeMovement"("cashCutId");
CREATE INDEX "CashSafeEnvelopeMovement_type_idx" ON "CashSafeEnvelopeMovement"("type");

ALTER TABLE "CashSafeEnvelopeMovement"
  ADD CONSTRAINT "CashSafeEnvelopeMovement_envelopeId_fkey"
  FOREIGN KEY ("envelopeId") REFERENCES "CashSafeEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashSafeEnvelopeMovement"
  ADD CONSTRAINT "CashSafeEnvelopeMovement_cashCutId_fkey"
  FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashSafeEnvelopeMovement"
  ADD CONSTRAINT "CashSafeEnvelopeMovement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nada mas. CashSafeMovement, CashCut, Branch, User: sin cambios
-- de columnas. Cero riesgo para datos existentes.
