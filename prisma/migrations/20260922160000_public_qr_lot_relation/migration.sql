ALTER TABLE "PublicQrProfile" ADD COLUMN "lotId" TEXT;
CREATE INDEX "PublicQrProfile_lotId_idx" ON "PublicQrProfile"("lotId");
ALTER TABLE "PublicQrProfile" ADD CONSTRAINT "PublicQrProfile_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
