-- Keep draft count rows empty until a user explicitly captures a quantity.
-- Existing quantity values are preserved; countedAt lets the application
-- distinguish old placeholder zeros from an explicit zero without rewriting
-- production count data.
ALTER TYPE "InventoryHandlingUnit" ADD VALUE IF NOT EXISTS 'BOLSA';

ALTER TABLE "InventoryCountItem"
  ALTER COLUMN "quantityCounted" DROP NOT NULL;

ALTER TABLE "InventoryCountItem"
  ADD COLUMN "countedAt" TIMESTAMP(3);
