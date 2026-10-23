-- Workforce branch assignments, reusable schedules and privacy-preserving clock geolocation.
-- Additive only: existing branches keep geofence enforcement disabled until an admin enables it.

-- Some DEV databases were prototyped with enum types before this formal migration.
-- These guarded creates reconcile that harmless drift without skipping any table,
-- column, index or constraint below.
DO $$ BEGIN CREATE TYPE "BranchAssignmentType" AS ENUM ('HOME', 'ALLOWED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TemplateApplyMode" AS ENUM ('ASK_BEFORE_APPLY', 'AUTO_CREATE_DRAFT', 'DO_NOT_APPLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ClockActionType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GeofenceValidationResult" AS ENUM ('INSIDE', 'OUTSIDE', 'UNAVAILABLE', 'PERMISSION_DENIED', 'LOW_ACCURACY', 'NOT_REQUIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GeofenceReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GeofenceOutsideBehavior" AS ENUM ('BLOCK', 'ALLOW_WITH_EXCEPTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS "geofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "templateApplyMode" "TemplateApplyMode" NOT NULL DEFAULT 'ASK_BEFORE_APPLY',
  ADD COLUMN IF NOT EXISTS "defaultScheduleTemplateId" TEXT;

ALTER TABLE "UserBranch"
  ADD COLUMN IF NOT EXISTS "assignmentType" "BranchAssignmentType" NOT NULL DEFAULT 'ALLOWED';

ALTER TABLE "ScheduledShift"
  ADD COLUMN IF NOT EXISTS "breakMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ScheduleTemplate"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ScheduleTemplateShift"
  ADD COLUMN IF NOT EXISTS "breakMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Branch_defaultScheduleTemplateId_key" ON "Branch"("defaultScheduleTemplateId");

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_defaultScheduleTemplateId_fkey"
  FOREIGN KEY ("defaultScheduleTemplateId") REFERENCES "ScheduleTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorkforceSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "requireGeolocationClockIn" BOOLEAN NOT NULL DEFAULT true,
  "requireGeolocationClockOut" BOOLEAN NOT NULL DEFAULT true,
  "outsideBehavior" "GeofenceOutsideBehavior" NOT NULL DEFAULT 'ALLOW_WITH_EXCEPTION',
  "requireOutsideReview" BOOLEAN NOT NULL DEFAULT true,
  "maximumAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkforceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClockGeolocationEvidence" (
  "id" TEXT NOT NULL,
  "timeClockId" TEXT NOT NULL,
  "action" "ClockActionType" NOT NULL,
  "result" "GeofenceValidationResult" NOT NULL,
  "distanceMeters" INTEGER,
  "accuracyMeters" DOUBLE PRECISION,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "reviewStatus" "GeofenceReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClockGeolocationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClockGeolocationEvidence_timeClockId_action_key"
  ON "ClockGeolocationEvidence"("timeClockId", "action");
CREATE INDEX "ClockGeolocationEvidence_result_checkedAt_idx"
  ON "ClockGeolocationEvidence"("result", "checkedAt");
CREATE INDEX "ClockGeolocationEvidence_reviewStatus_checkedAt_idx"
  ON "ClockGeolocationEvidence"("reviewStatus", "checkedAt");

ALTER TABLE "WorkforceSettings"
  ADD CONSTRAINT "WorkforceSettings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockGeolocationEvidence"
  ADD CONSTRAINT "ClockGeolocationEvidence_timeClockId_fkey"
  FOREIGN KEY ("timeClockId") REFERENCES "TimeClockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClockGeolocationEvidence"
  ADD CONSTRAINT "ClockGeolocationEvidence_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WorkforceSettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
