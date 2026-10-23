ALTER TABLE "CashCut" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "CashCut" ADD COLUMN "archivedById" TEXT;

CREATE INDEX "CashCut_archivedAt_idx" ON "CashCut"("archivedAt");
