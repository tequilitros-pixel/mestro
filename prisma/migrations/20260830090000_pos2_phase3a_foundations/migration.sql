-- POS 2.0 Phase 3A: additive infrastructure only.
-- Reviewed for PostgreSQL. It does not alter legacy financial Float columns
-- and does not remove or rewrite historical rows.

ALTER TABLE "PosSale" ADD COLUMN "clientPayloadHash" TEXT;

CREATE TYPE "OperationReceiptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED_FINAL');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "CapabilityScope" AS ENUM ('SELF', 'BRANCH', 'MULTI_BRANCH', 'GLOBAL');

CREATE TABLE "OperationReceipt" (
  "operationId" UUID NOT NULL,
  "command" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "OperationReceiptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "result" JSONB,
  "resultType" TEXT,
  "resultId" TEXT,
  "actorId" TEXT,
  "branchId" TEXT,
  "context" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "OperationReceipt_pkey" PRIMARY KEY ("operationId")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "branchId" TEXT,
  "terminalId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operationId" UUID,
  "correlationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboxEvent" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "aggregate" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "operationId" UUID,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Capability" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapabilityGrant" (
  "id" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "userId" TEXT,
  "role" "UserRole",
  "scope" "CapabilityScope" NOT NULL,
  "branchId" TEXT,
  "constraints" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "CapabilityGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CapabilityGrant_subject_check" CHECK (
    ("userId" IS NOT NULL AND "role" IS NULL) OR
    ("userId" IS NULL AND "role" IS NOT NULL)
  ),
  CONSTRAINT "CapabilityGrant_scope_check" CHECK (
    ("scope" = 'BRANCH' AND "branchId" IS NOT NULL) OR
    ("scope" <> 'BRANCH')
  )
);

CREATE UNIQUE INDEX "Capability_key_key" ON "Capability"("key");
CREATE INDEX "OperationReceipt_command_createdAt_idx" ON "OperationReceipt"("command", "createdAt");
CREATE INDEX "OperationReceipt_actorId_createdAt_idx" ON "OperationReceipt"("actorId", "createdAt");
CREATE INDEX "OperationReceipt_branchId_createdAt_idx" ON "OperationReceipt"("branchId", "createdAt");
CREATE INDEX "OperationReceipt_status_createdAt_idx" ON "OperationReceipt"("status", "createdAt");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");
CREATE INDEX "AuditEvent_branchId_createdAt_idx" ON "AuditEvent"("branchId", "createdAt");
CREATE INDEX "AuditEvent_operationId_idx" ON "AuditEvent"("operationId");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX "OutboxEvent_status_availableAt_createdAt_idx" ON "OutboxEvent"("status", "availableAt", "createdAt");
CREATE INDEX "OutboxEvent_aggregate_aggregateId_idx" ON "OutboxEvent"("aggregate", "aggregateId");
CREATE INDEX "OutboxEvent_operationId_idx" ON "OutboxEvent"("operationId");
CREATE INDEX "CapabilityGrant_capabilityId_userId_validFrom_validTo_idx" ON "CapabilityGrant"("capabilityId", "userId", "validFrom", "validTo");
CREATE INDEX "CapabilityGrant_capabilityId_role_validFrom_validTo_idx" ON "CapabilityGrant"("capabilityId", "role", "validFrom", "validTo");
CREATE INDEX "CapabilityGrant_branchId_idx" ON "CapabilityGrant"("branchId");

CREATE FUNCTION "prevent_audit_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_event_mutation"();

ALTER TABLE "CapabilityGrant" ADD CONSTRAINT "CapabilityGrant_capabilityId_fkey"
  FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Capability" ("id", "key", "description", "active", "createdAt", "updatedAt") VALUES
  ('cap-pos-sale-create', 'pos.sale.create', 'Completar ventas', true, NOW(), NOW()),
  ('cap-pos-discount-apply', 'pos.discount.apply', 'Aplicar descuentos', true, NOW(), NOW()),
  ('cap-pos-courtesy-apply', 'pos.courtesy.apply', 'Aplicar cortesías', true, NOW(), NOW()),
  ('cap-pos-sale-cancel', 'pos.sale.cancel', 'Cancelar ventas', true, NOW(), NOW()),
  ('cap-pos-return-create', 'pos.return.create', 'Crear devoluciones', true, NOW(), NOW()),
  ('cap-pos-refund-create', 'pos.refund.create', 'Emitir reembolsos', true, NOW(), NOW()),
  ('cap-cash-session-open', 'cash.session.open', 'Abrir sesión de caja', true, NOW(), NOW()),
  ('cap-cash-session-close', 'cash.session.close', 'Cerrar sesión de caja', true, NOW(), NOW()),
  ('cap-cash-adjust', 'cash.adjust', 'Ajustar caja', true, NOW(), NOW()),
  ('cap-inventory-adjust', 'inventory.adjust', 'Ajustar inventario', true, NOW(), NOW()),
  ('cap-catalog-edit', 'catalog.edit', 'Editar catálogo', true, NOW(), NOW()),
  ('cap-pricing-edit', 'pricing.edit', 'Editar precios', true, NOW(), NOW()),
  ('cap-branch-manage', 'branch.manage', 'Administrar sucursales', true, NOW(), NOW());
