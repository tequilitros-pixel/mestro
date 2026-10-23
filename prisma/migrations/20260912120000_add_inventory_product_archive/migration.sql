-- Additive inventory archive state. Existing products remain unarchived.
ALTER TABLE "InventoryProduct" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "InventoryProduct_archivedAt_idx" ON "InventoryProduct"("archivedAt");

ALTER TABLE "InventoryCount"
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedById" TEXT;

CREATE INDEX "InventoryCount_closedById_idx" ON "InventoryCount"("closedById");

ALTER TABLE "InventoryCount"
  ADD CONSTRAINT "InventoryCount_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryCountDeclaration"
  ADD COLUMN "countId" TEXT;

CREATE INDEX "InventoryCountDeclaration_countId_idx" ON "InventoryCountDeclaration"("countId");

ALTER TABLE "InventoryCountDeclaration"
  ADD CONSTRAINT "InventoryCountDeclaration_countId_fkey"
  FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
