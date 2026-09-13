-- Approved corrections are final. A later decision may compensate an event
-- supplied by a prior correction without editing either administrative fact.
ALTER TABLE "ClockCorrection" ADD COLUMN "targetCorrectionId" TEXT;
CREATE INDEX "ClockCorrection_targetCorrectionId_idx" ON "ClockCorrection"("targetCorrectionId");
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_targetCorrectionId_fkey" FOREIGN KEY ("targetCorrectionId") REFERENCES "ClockCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
