-- Multi-day milling work sessions.
CREATE TABLE "MillingWorkSession" (
  "id" TEXT NOT NULL,
  "millingId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "startedById" TEXT NOT NULL,
  "endedById" TEXT,
  "startOperationId" TEXT NOT NULL,
  "endOperationId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MillingWorkSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MillingWorkSession_startOperationId_key" ON "MillingWorkSession"("startOperationId");
CREATE UNIQUE INDEX "MillingWorkSession_endOperationId_key" ON "MillingWorkSession"("endOperationId");
CREATE INDEX "MillingWorkSession_millingId_startedAt_idx" ON "MillingWorkSession"("millingId", "startedAt");
CREATE INDEX "MillingWorkSession_startedById_idx" ON "MillingWorkSession"("startedById");
CREATE INDEX "MillingWorkSession_endedById_idx" ON "MillingWorkSession"("endedById");
CREATE UNIQUE INDEX "MillingWorkSession_one_open_per_milling" ON "MillingWorkSession"("millingId") WHERE "endedAt" IS NULL;

ALTER TABLE "MillingWorkSession" ADD CONSTRAINT "MillingWorkSession_millingId_fkey" FOREIGN KEY ("millingId") REFERENCES "Milling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MillingWorkSession" ADD CONSTRAINT "MillingWorkSession_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MillingWorkSession" ADD CONSTRAINT "MillingWorkSession_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stable tank identity for fermentation workspaces. Historical rows are
-- backfilled only when the stored tank name identifies one active TINA.
ALTER TABLE "Fermentation" ADD COLUMN "tankId" TEXT;
WITH unique_tanks AS (
  SELECT MIN("id") AS "id", "name"
  FROM "Equipment"
  WHERE "type" = 'TINA'
  GROUP BY "name"
  HAVING COUNT(*) = 1
), unique_fermentations AS (
  SELECT MIN("id") AS "id"
  FROM "Fermentation"
  GROUP BY "lotId", "tank"
  HAVING COUNT(*) = 1
)
UPDATE "Fermentation" f
SET "tankId" = t."id"
FROM unique_tanks t, unique_fermentations uf
WHERE f."id" = uf."id" AND t."name" = f."tank";
CREATE INDEX "Fermentation_tankId_idx" ON "Fermentation"("tankId");
CREATE UNIQUE INDEX "Fermentation_one_per_lot_tank" ON "Fermentation"("lotId", "tankId") WHERE "tankId" IS NOT NULL;
ALTER TABLE "Fermentation" ADD CONSTRAINT "Fermentation_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every distillation run records its exact source, allowing several
-- alambiques to consume one tina without exceeding its remaining volume.
ALTER TABLE "Distillation"
  ADD COLUMN "fillPercent" DOUBLE PRECISION,
  ADD COLUMN "sourceFermentationId" TEXT,
  ADD COLUMN "sourceDistillationId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT;

ALTER TYPE "DistillationStatus" ADD VALUE IF NOT EXISTS 'CANCELADA';
CREATE INDEX "Distillation_sourceFermentationId_idx" ON "Distillation"("sourceFermentationId");
CREATE INDEX "Distillation_sourceDistillationId_idx" ON "Distillation"("sourceDistillationId");
CREATE INDEX "Distillation_cancelledById_idx" ON "Distillation"("cancelledById");
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_sourceFermentationId_fkey" FOREIGN KEY ("sourceFermentationId") REFERENCES "Fermentation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_sourceDistillationId_fkey" FOREIGN KEY ("sourceDistillationId") REFERENCES "Distillation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Avoid opening the same process link twice while preserving its history.
WITH duplicate_links AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "processType", "processId"
    ORDER BY "startedAt" DESC, "createdAt" DESC, "id" DESC
  ) AS position
  FROM "BoilerProcessLink"
  WHERE "endedAt" IS NULL AND "processId" IS NOT NULL
)
UPDATE "BoilerProcessLink" link
SET "endedAt" = link."startedAt"
FROM duplicate_links duplicate
WHERE link."id" = duplicate."id" AND duplicate.position > 1;
CREATE UNIQUE INDEX "BoilerProcessLink_one_open_process" ON "BoilerProcessLink"("processType", "processId") WHERE "endedAt" IS NULL AND "processId" IS NOT NULL;
