-- Configuración operativa por producto y sucursal.
-- Es aditiva: no toca conteos cerrados, saldos ni movimientos históricos.
CREATE TABLE "BranchInventoryMinimum" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "inventoryProductId" TEXT NOT NULL,
  "minimumQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BranchInventoryMinimum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchInventoryMinimum_branchId_inventoryProductId_key"
  ON "BranchInventoryMinimum"("branchId", "inventoryProductId");
CREATE INDEX "BranchInventoryMinimum_branchId_idx"
  ON "BranchInventoryMinimum"("branchId");
CREATE INDEX "BranchInventoryMinimum_inventoryProductId_idx"
  ON "BranchInventoryMinimum"("inventoryProductId");

ALTER TABLE "BranchInventoryMinimum"
  ADD CONSTRAINT "BranchInventoryMinimum_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchInventoryMinimum"
  ADD CONSTRAINT "BranchInventoryMinimum_inventoryProductId_fkey"
  FOREIGN KEY ("inventoryProductId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
