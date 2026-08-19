CREATE TYPE "InventoryHandlingUnit" AS ENUM ('BOTELLA', 'GARRAFA', 'CAJA', 'PAQUETE', 'PIEZA', 'KILOGRAMO', 'LITRO', 'OTRA');
CREATE TYPE "InventoryContentUnit" AS ENUM ('ML', 'L', 'G', 'KG', 'PIEZAS');

ALTER TABLE "InventoryProduct" ADD COLUMN "handlingUnit" "InventoryHandlingUnit";
ALTER TABLE "InventoryProduct" ADD COLUMN "contentPerUnit" DECIMAL(12,3);
ALTER TABLE "InventoryProduct" ADD COLUMN "contentUnit" "InventoryContentUnit";
ALTER TABLE "InventoryProduct" ADD COLUMN "normalizedContentPerUnit" DECIMAL(14,3);

ALTER TABLE "InventoryEntry" ADD COLUMN "originalQuantity" DECIMAL(12,3);
ALTER TABLE "InventoryEntry" ADD COLUMN "originalUnit" TEXT;
ALTER TABLE "InventoryEntry" ADD COLUMN "handlingUnit" "InventoryHandlingUnit";
ALTER TABLE "InventoryEntry" ADD COLUMN "contentPerUnit" DECIMAL(12,3);
ALTER TABLE "InventoryEntry" ADD COLUMN "contentUnit" "InventoryContentUnit";

ALTER TABLE "ServiceEventItem" ADD COLUMN "handlingUnit" "InventoryHandlingUnit";
ALTER TABLE "ServiceEventItem" ADD COLUMN "contentPerUnit" DECIMAL(12,3);
ALTER TABLE "ServiceEventItem" ADD COLUMN "contentUnit" "InventoryContentUnit";
ALTER TABLE "ServiceEventItem" ADD COLUMN "returnedOpenQuantity" DECIMAL(12,3);
ALTER TABLE "ServiceEventItem" ADD COLUMN "checkoutStatus" TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "ServiceEventItem" ADD COLUMN "returnStatus" TEXT NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "ServiceEventItem" ADD COLUMN "checkoutNotes" TEXT;
ALTER TABLE "ServiceEventItem" ADD COLUMN "returnNotes" TEXT;
ALTER TABLE "ServiceEvent" ADD COLUMN "checkoutConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ServiceEvent" ADD COLUMN "checkoutConfirmedById" TEXT;
ALTER TABLE "ServiceEvent" ADD COLUMN "returnConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ServiceEvent" ADD COLUMN "returnConfirmedById" TEXT;
