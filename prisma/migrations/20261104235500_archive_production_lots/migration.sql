-- Preserve trial and erroneous production lots without treating them as
-- completed production or generating inventory movements.
ALTER TABLE "Lot"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "Lot_archivedAt_idx" ON "Lot"("archivedAt");
