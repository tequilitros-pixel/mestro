-- Additive / nullability-relaxing support for honest legacy Workforce imports.
CREATE TYPE "WorkSessionOrigin" AS ENUM ('NATIVE_RECONSTRUCTED', 'LEGACY_IMPORTED');
CREATE TYPE "WorkforceMigrationClassification" AS ENUM ('SAFE', 'SAFE_WITH_UNKNOWN', 'REVIEW_REQUIRED', 'ARCHIVE_ONLY', 'SKIPPED');
CREATE TYPE "WorkforceMigrationStatus" AS ENUM ('PENDING', 'MIGRATED', 'REVIEW', 'SKIPPED', 'FAILED');

ALTER TABLE "Employee"
  ADD COLUMN "displayName" TEXT,
  ALTER COLUMN "firstName" DROP NOT NULL,
  ALTER COLUMN "lastName" DROP NOT NULL;

ALTER TABLE "PayRate"
  ALTER COLUMN "currency" DROP NOT NULL;

ALTER TABLE "WorkSession"
  ALTER COLUMN "breakMinutes" DROP DEFAULT,
  ALTER COLUMN "breakMinutes" DROP NOT NULL,
  ADD COLUMN "origin" "WorkSessionOrigin" NOT NULL DEFAULT 'NATIVE_RECONSTRUCTED';

CREATE TABLE "WorkforceMigrationRecord" (
  "id" TEXT NOT NULL,
  "migrationVersion" TEXT NOT NULL,
  "legacyModel" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "targetModel" TEXT,
  "targetId" TEXT,
  "classification" "WorkforceMigrationClassification" NOT NULL,
  "confidence" "DataConfidence",
  "status" "WorkforceMigrationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkforceMigrationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkforceMigrationRecord_migrationVersion_legacyModel_legacyId_key"
  ON "WorkforceMigrationRecord"("migrationVersion", "legacyModel", "legacyId");
CREATE INDEX "WorkforceMigrationRecord_status_classification_idx"
  ON "WorkforceMigrationRecord"("status", "classification");
CREATE INDEX "WorkforceMigrationRecord_targetModel_targetId_idx"
  ON "WorkforceMigrationRecord"("targetModel", "targetId");
