-- POS 2.0 Phase 3F: InventoryProduct-only physical ledger and balance projection.
CREATE TYPE "InventoryMovementTypeV2" AS ENUM ('OPENING_BALANCE','RECEIPT','SALE_CONSUMPTION','SALE_REVERSAL','TRANSFER_OUT','TRANSFER_IN','ADJUSTMENT_IN','ADJUSTMENT_OUT','COUNT_CORRECTION','EVENT_LOAD','EVENT_RETURN');
CREATE TYPE "InventoryMovementSourceType" AS ENUM ('LEGACY_OPENING','RECEIPT','MANUAL_ADJUSTMENT','COUNT','TRANSFER','SALE','RETURN','EVENT','RECIPE_CONSUMPTION');
ALTER TABLE "InventoryProduct" ADD COLUMN "inventoryBaseUnit" "CatalogBaseUnit";

CREATE TABLE "InventoryBalance" (
 "id" TEXT PRIMARY KEY, "branchId" TEXT NOT NULL, "inventoryProductId" TEXT NOT NULL,
 "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0, "unit" "CatalogBaseUnit" NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "InventoryBalance_quantity_nonnegative" CHECK ("quantity" >= 0), CONSTRAINT "InventoryBalance_version_positive" CHECK ("version" > 0)
);
CREATE TABLE "InventoryMovement" (
 "id" TEXT PRIMARY KEY, "branchId" TEXT NOT NULL, "inventoryProductId" TEXT NOT NULL,
 "movementType" "InventoryMovementTypeV2" NOT NULL, "quantityDelta" DECIMAL(18,6) NOT NULL, "unit" "CatalogBaseUnit" NOT NULL,
 "balanceBefore" DECIMAL(18,6) NOT NULL, "balanceAfter" DECIMAL(18,6) NOT NULL,
 "sourceType" "InventoryMovementSourceType" NOT NULL, "sourceId" TEXT NOT NULL, "sourceLineId" TEXT,
 "actorId" TEXT NOT NULL, "operationId" UUID NOT NULL, "reasonCode" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InventoryMovement_delta_nonzero" CHECK ("quantityDelta" <> 0),
 CONSTRAINT "InventoryMovement_balance_equation" CHECK ("balanceAfter" = "balanceBefore" + "quantityDelta"),
 CONSTRAINT "InventoryMovement_balance_nonnegative" CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0),
 CONSTRAINT "InventoryMovement_source_required" CHECK (length(btrim("sourceId")) > 0 AND length(btrim("reasonCode")) > 0)
);
CREATE TABLE "InventoryCountDeclaration" (
 "id" TEXT PRIMARY KEY, "branchId" TEXT NOT NULL, "inventoryProductId" TEXT NOT NULL,
 "expectedQuantity" DECIMAL(18,6) NOT NULL, "declaredQuantity" DECIMAL(18,6) NOT NULL, "unit" "CatalogBaseUnit" NOT NULL,
 "movementId" TEXT, "actorId" TEXT NOT NULL, "operationId" UUID NOT NULL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InventoryCountDeclaration_nonnegative" CHECK ("expectedQuantity" >= 0 AND "declaredQuantity" >= 0)
);
CREATE UNIQUE INDEX "InventoryBalance_branchId_inventoryProductId_key" ON "InventoryBalance"("branchId","inventoryProductId");
CREATE INDEX "InventoryBalance_branchId_idx" ON "InventoryBalance"("branchId");
CREATE INDEX "InventoryMovement_branchId_createdAt_idx" ON "InventoryMovement"("branchId","createdAt");
CREATE INDEX "InventoryMovement_inventoryProductId_createdAt_idx" ON "InventoryMovement"("inventoryProductId","createdAt");
CREATE INDEX "InventoryMovement_sourceType_sourceId_idx" ON "InventoryMovement"("sourceType","sourceId");
CREATE INDEX "InventoryMovement_operationId_idx" ON "InventoryMovement"("operationId");
CREATE INDEX "InventoryMovement_movementType_createdAt_idx" ON "InventoryMovement"("movementType","createdAt");
CREATE UNIQUE INDEX "InventoryCountDeclaration_movementId_key" ON "InventoryCountDeclaration"("movementId");
CREATE UNIQUE INDEX "InventoryCountDeclaration_operationId_key" ON "InventoryCountDeclaration"("operationId");
CREATE INDEX "InventoryCountDeclaration_branchId_createdAt_idx" ON "InventoryCountDeclaration"("branchId","createdAt");
CREATE INDEX "InventoryCountDeclaration_inventoryProductId_createdAt_idx" ON "InventoryCountDeclaration"("inventoryProductId","createdAt");
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountDeclaration" ADD CONSTRAINT "InventoryCountDeclaration_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountDeclaration" ADD CONSTRAINT "InventoryCountDeclaration_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION pos2_inventory_movement_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INVENTORY_MOVEMENT_IS_APPEND_ONLY' USING ERRCODE='55000'; END $$;
CREATE TRIGGER "InventoryMovement_immutable" BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION pos2_inventory_movement_immutable();

INSERT INTO "Capability" ("id","key","description","active","createdAt","updatedAt") VALUES
 ('cap-inventory-view','inventory.view','Consultar Inventory V2',true,NOW(),NOW()),
 ('cap-inventory-receive','inventory.receive','Recibir InventoryProducts',true,NOW(),NOW()),
 ('cap-inventory-count','inventory.count','Declarar conteos Inventory V2',true,NOW(),NOW()),
 ('cap-inventory-transfer','inventory.transfer','Transferir InventoryProducts',true,NOW(),NOW()),
 ('cap-inventory-reconcile','inventory.reconcile','Reconciliar ledger y balances',true,NOW(),NOW());
INSERT INTO "CapabilityGrant" ("id","capabilityId","role","scope","validFrom","createdAt")
SELECT 'grant-admin-'||replace("key",'.','-'),"id",'ADMIN','GLOBAL',NOW(),NOW() FROM "Capability"
WHERE "key" IN ('inventory.view','inventory.receive','inventory.count','inventory.transfer','inventory.reconcile');
INSERT INTO "CapabilityGrant" ("id","capabilityId","role","scope","validFrom","createdAt")
SELECT 'grant-admin-inventory-adjust-v2',"id",'ADMIN','GLOBAL',NOW(),NOW() FROM "Capability" WHERE "key"='inventory.adjust'
AND NOT EXISTS (SELECT 1 FROM "CapabilityGrant" g WHERE g."capabilityId"="Capability"."id" AND g."role"='ADMIN' AND g."scope"='GLOBAL');
