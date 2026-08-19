CREATE TYPE "PosDiscountRuleMode" AS ENUM ('DISCOUNT', 'BLOCK');

CREATE TABLE "PosDiscountRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mode" "PosDiscountRuleMode" NOT NULL DEFAULT 'DISCOUNT',
  "percent" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PosDiscountRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_BranchToPosDiscountRule" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_BranchToPosDiscountRule_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "PosDiscountRule_active_mode_idx" ON "PosDiscountRule"("active", "mode");
CREATE INDEX "PosDiscountRule_startDate_endDate_idx" ON "PosDiscountRule"("startDate", "endDate");
CREATE INDEX "_BranchToPosDiscountRule_B_index" ON "_BranchToPosDiscountRule"("B");

ALTER TABLE "PosDiscountRule" ADD CONSTRAINT "PosDiscountRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosDiscountRule" ADD CONSTRAINT "PosDiscountRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_BranchToPosDiscountRule" ADD CONSTRAINT "_BranchToPosDiscountRule_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BranchToPosDiscountRule" ADD CONSTRAINT "_BranchToPosDiscountRule_B_fkey" FOREIGN KEY ("B") REFERENCES "PosDiscountRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
