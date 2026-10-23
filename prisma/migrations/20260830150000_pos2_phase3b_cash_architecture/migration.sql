-- POS 2.0 Phase 3B: Register, Terminal enrollment and CashSession ledger.
-- Additive only. CashCut remains the legacy projection and envelope anchor.

CREATE TYPE "TerminalStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'CANCELLED');
CREATE TYPE "CashDeclarationType" AS ENUM ('OPENING', 'CLOSING', 'RECOUNT');
CREATE TYPE "CashMovementType" AS ENUM ('OPENING_FLOAT', 'SALE_CASH', 'CASH_IN', 'CASH_OUT', 'REFUND_CASH', 'ADJUSTMENT', 'SAFE_TRANSFER');
CREATE TYPE "CashMovementDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "Register" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Terminal" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceIdentifier" TEXT,
  "credentialHash" TEXT,
  "status" "TerminalStatus" NOT NULL DEFAULT 'DISABLED',
  "enrolledAt" TIMESTAMP(3),
  "credentialIssuedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalEnrollment" (
  "id" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerminalEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashSession" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "openingTerminalId" TEXT NOT NULL,
  "openedById" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
  "closingTerminalId" TEXT,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "expectedCash" DECIMAL(18,2),
  "difference" DECIMAL(18,2),
  "cashCutId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashDeclaration" (
  "id" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "type" "CashDeclarationType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "actorId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "reason" TEXT,
  "supersedesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDeclaration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashDeclaration_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "CashMovement" (
  "id" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "direction" "CashMovementDirection" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "actorId" TEXT NOT NULL,
  "operationId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashMovement_amount_check" CHECK (
    "amount" > 0 OR ("type" = 'OPENING_FLOAT' AND "amount" = 0)
  )
);

CREATE UNIQUE INDEX "Register_branchId_code_key" ON "Register"("branchId", "code");
CREATE INDEX "Register_branchId_idx" ON "Register"("branchId");
CREATE INDEX "Register_active_idx" ON "Register"("active");
CREATE UNIQUE INDEX "Terminal_deviceIdentifier_key" ON "Terminal"("deviceIdentifier");
CREATE INDEX "Terminal_branchId_idx" ON "Terminal"("branchId");
CREATE INDEX "Terminal_status_idx" ON "Terminal"("status");
CREATE UNIQUE INDEX "TerminalEnrollment_tokenHash_key" ON "TerminalEnrollment"("tokenHash");
CREATE INDEX "TerminalEnrollment_terminalId_expiresAt_idx" ON "TerminalEnrollment"("terminalId", "expiresAt");
CREATE UNIQUE INDEX "CashSession_cashCutId_key" ON "CashSession"("cashCutId");
CREATE UNIQUE INDEX "CashSession_one_active_per_register" ON "CashSession"("registerId") WHERE "status" IN ('OPEN', 'CLOSING');
CREATE INDEX "CashSession_registerId_status_idx" ON "CashSession"("registerId", "status");
CREATE INDEX "CashSession_branchId_openedAt_idx" ON "CashSession"("branchId", "openedAt");
CREATE INDEX "CashSession_openedById_idx" ON "CashSession"("openedById");
CREATE INDEX "CashDeclaration_cashSessionId_createdAt_idx" ON "CashDeclaration"("cashSessionId", "createdAt");
CREATE INDEX "CashDeclaration_supersedesId_idx" ON "CashDeclaration"("supersedesId");
CREATE UNIQUE INDEX "CashMovement_operationId_key" ON "CashMovement"("operationId");
CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");
CREATE INDEX "CashMovement_branchId_createdAt_idx" ON "CashMovement"("branchId", "createdAt");
CREATE INDEX "CashMovement_operationId_idx" ON "CashMovement"("operationId");
CREATE INDEX "CashMovement_sourceType_sourceId_idx" ON "CashMovement"("sourceType", "sourceId");

CREATE FUNCTION "prevent_cash_financial_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CashDeclaration_append_only" BEFORE UPDATE OR DELETE ON "CashDeclaration"
  FOR EACH ROW EXECUTE FUNCTION "prevent_cash_financial_history_mutation"();
CREATE TRIGGER "CashMovement_append_only" BEFORE UPDATE OR DELETE ON "CashMovement"
  FOR EACH ROW EXECUTE FUNCTION "prevent_cash_financial_history_mutation"();

ALTER TABLE "Register" ADD CONSTRAINT "Register_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Register" ADD CONSTRAINT "Register_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalEnrollment" ADD CONSTRAINT "TerminalEnrollment_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalEnrollment" ADD CONSTRAINT "TerminalEnrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openingTerminalId_fkey" FOREIGN KEY ("openingTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closingTerminalId_fkey" FOREIGN KEY ("closingTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDeclaration" ADD CONSTRAINT "CashDeclaration_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDeclaration" ADD CONSTRAINT "CashDeclaration_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDeclaration" ADD CONSTRAINT "CashDeclaration_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDeclaration" ADD CONSTRAINT "CashDeclaration_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CashDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Capability" ("id", "key", "description", "active", "createdAt", "updatedAt") VALUES
  ('cap-cash-declaration-create', 'cash.declaration.create', 'Crear declaraciones de efectivo', true, NOW(), NOW()),
  ('cap-cash-recount', 'cash.recount', 'Crear recuentos de efectivo', true, NOW(), NOW()),
  ('cap-cash-in-create', 'cash.in.create', 'Registrar entradas de efectivo', true, NOW(), NOW()),
  ('cap-cash-out-create', 'cash.out.create', 'Registrar salidas de efectivo', true, NOW(), NOW()),
  ('cap-register-manage', 'register.manage', 'Administrar cajas lógicas', true, NOW(), NOW()),
  ('cap-terminal-manage', 'terminal.manage', 'Administrar terminales', true, NOW(), NOW());

INSERT INTO "CapabilityGrant" ("id", "capabilityId", "role", "scope", "validFrom", "createdAt") VALUES
  ('grant-admin-cash-session-open', 'cap-cash-session-open', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-session-close', 'cap-cash-session-close', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-declaration-create', 'cap-cash-declaration-create', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-recount', 'cap-cash-recount', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-in-create', 'cap-cash-in-create', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-out-create', 'cap-cash-out-create', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-cash-adjust', 'cap-cash-adjust', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-register-manage', 'cap-register-manage', 'ADMIN', 'GLOBAL', NOW(), NOW()),
  ('grant-admin-terminal-manage', 'cap-terminal-manage', 'ADMIN', 'GLOBAL', NOW(), NOW());
