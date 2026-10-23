-- Keep existing schedules visible while giving each edited/new shift an
-- independent publication state for branch/employee-level publishing.
CREATE TYPE "ScheduledShiftPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "ScheduledShift"
ADD COLUMN "publicationStatus" "ScheduledShiftPublicationStatus" NOT NULL DEFAULT 'PUBLISHED';

-- Weeks explicitly left as drafts must remain hidden after the backfill.
UPDATE "ScheduledShift" AS shift
SET "publicationStatus" = 'DRAFT'
FROM "ScheduleWeek" AS week
WHERE week."status" = 'DRAFT'
  AND shift."date" >= week."weekStart"
  AND shift."date" < week."weekStart" + INTERVAL '7 days';

CREATE INDEX "ScheduledShift_publicationStatus_idx"
ON "ScheduledShift"("publicationStatus");
