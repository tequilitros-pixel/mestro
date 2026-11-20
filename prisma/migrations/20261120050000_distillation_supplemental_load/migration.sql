-- Registro aditivo y auditable de cargas de distintas tinas en una misma
-- corrida de destrozado. Sin modificaciones ni backfill sobre corridas previas.
CREATE TABLE IF NOT EXISTS "DistillationSupplementalLoad" (
    "id" TEXT NOT NULL,
    "distillationId" TEXT NOT NULL,
    "fermentationId" TEXT NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistillationSupplementalLoad_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DistillationSupplementalLoad_positive_liters" CHECK ("liters" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "DistillationSupplementalLoad_idempotencyKey_key"
ON "DistillationSupplementalLoad"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DistillationSupplementalLoad_distillationId_idx"
ON "DistillationSupplementalLoad"("distillationId");
CREATE INDEX IF NOT EXISTS "DistillationSupplementalLoad_fermentationId_idx"
ON "DistillationSupplementalLoad"("fermentationId");

DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DistillationSupplementalLoad_distillationId_fkey') THEN
    ALTER TABLE "DistillationSupplementalLoad"
      ADD CONSTRAINT "DistillationSupplementalLoad_distillationId_fkey"
      FOREIGN KEY ("distillationId") REFERENCES "Distillation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DistillationSupplementalLoad_fermentationId_fkey') THEN
    ALTER TABLE "DistillationSupplementalLoad"
      ADD CONSTRAINT "DistillationSupplementalLoad_fermentationId_fkey"
      FOREIGN KEY ("fermentationId") REFERENCES "Fermentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DistillationSupplementalLoad_recordedById_fkey') THEN
    ALTER TABLE "DistillationSupplementalLoad"
      ADD CONSTRAINT "DistillationSupplementalLoad_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;
