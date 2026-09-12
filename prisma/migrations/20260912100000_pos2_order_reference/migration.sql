ALTER TABLE "Pos2Order" ADD COLUMN "reference" TEXT;

CREATE INDEX "Pos2Order_branchId_reference_idx" ON "Pos2Order"("branchId", "reference");
