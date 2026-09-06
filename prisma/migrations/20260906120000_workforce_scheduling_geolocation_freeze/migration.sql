-- Scheduling release: preserve geometry/history but disable enforcement.
BEGIN;
UPDATE "Branch" SET "geofenceEnabled" = false WHERE "geofenceEnabled" = true;
ALTER TABLE "Branch" ALTER COLUMN "geofenceEnabled" SET DEFAULT false;
UPDATE "Branch" SET "templateApplyMode" = 'ASK_BEFORE_APPLY' WHERE "templateApplyMode" = 'AUTO_CREATE_DRAFT';
COMMIT;
