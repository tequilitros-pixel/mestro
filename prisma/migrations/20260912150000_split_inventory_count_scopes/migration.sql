-- Split inventory counts into an explicit weekly beverage/operational-input
-- scope and a monthly all-countable-inventory scope. Existing count rows stay
-- weekly for backwards compatibility; no quantities or ledger rows change.
CREATE TYPE "InventoryCountFrequency" AS ENUM ('UNCLASSIFIED', 'WEEKLY', 'MONTHLY_ONLY');
CREATE TYPE "InventoryCountType" AS ENUM ('WEEKLY', 'MONTHLY');

ALTER TABLE "InventoryProduct"
  ADD COLUMN "countFrequency" "InventoryCountFrequency" NOT NULL DEFAULT 'UNCLASSIFIED';

CREATE INDEX "InventoryProduct_countFrequency_idx"
  ON "InventoryProduct"("countFrequency");

ALTER TABLE "InventoryCount"
  ADD COLUMN "countType" "InventoryCountType" NOT NULL DEFAULT 'WEEKLY';

CREATE INDEX "InventoryCount_countType_idx"
  ON "InventoryCount"("countType");

-- Safe, deterministic initial classification from existing product semantics:
-- equipment belongs to the broad monthly count; consumables/returnables that
-- are used directly by a POS recipe belong to the weekly scope. Ambiguous
-- products remain UNCLASSIFIED for an administrator to review.
UPDATE "InventoryProduct" AS p
SET "countFrequency" = 'MONTHLY_ONLY'
WHERE p."itemType" = 'EQUIPMENT'
  AND p."countFrequency" = 'UNCLASSIFIED';

UPDATE "InventoryProduct" AS p
SET "countFrequency" = 'WEEKLY'
WHERE p."itemType" IN ('CONSUMABLE', 'RETURNABLE')
  AND p."countFrequency" = 'UNCLASSIFIED'
  AND EXISTS (
    SELECT 1
    FROM "PosVariantIngredient" AS ingredient
    WHERE ingredient."inventoryProductId" = p."id"
  );
