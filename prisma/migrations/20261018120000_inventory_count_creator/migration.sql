ALTER TABLE "InventoryCount" ADD COLUMN "createdById" TEXT;

CREATE INDEX "InventoryCount_createdById_idx" ON "InventoryCount"("createdById");

ALTER TABLE "InventoryCount"
ADD CONSTRAINT "InventoryCount_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
