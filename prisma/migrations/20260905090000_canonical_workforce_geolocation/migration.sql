-- Canonical bridge: keep the initial additive migration intact while moving
-- the active Workforce path to immutable ClockEvent and versioned policy.
-- No legacy row is deleted or rewritten.

ALTER TABLE "ClockGeolocationEvidence"
  ALTER COLUMN "timeClockId" DROP NOT NULL,
  ALTER COLUMN "action" DROP NOT NULL,
  ADD COLUMN "clockEventId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "attendanceExceptionId" TEXT;

ALTER TABLE "WorkforcePolicyVersion"
  ADD COLUMN "requireGeolocationClockIn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireGeolocationClockOut" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "geofenceOutsideBehavior" "GeofenceOutsideBehavior" NOT NULL DEFAULT 'ALLOW_WITH_EXCEPTION',
  ADD COLUMN "requireOutsideGeofenceReview" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "maximumGpsAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
  ADD CONSTRAINT "WorkforcePolicyVersion_gps_accuracy_check"
    CHECK ("maximumGpsAccuracyMeters" BETWEEN 10 AND 1000);

ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'OUTSIDE_GEOFENCE';

CREATE UNIQUE INDEX "ClockGeolocationEvidence_clockEventId_key"
  ON "ClockGeolocationEvidence"("clockEventId");
CREATE UNIQUE INDEX "ClockGeolocationEvidence_attendanceExceptionId_key"
  ON "ClockGeolocationEvidence"("attendanceExceptionId");
CREATE INDEX "ClockGeolocationEvidence_branchId_checkedAt_idx"
  ON "ClockGeolocationEvidence"("branchId", "checkedAt");

ALTER TABLE "ClockGeolocationEvidence"
  ADD CONSTRAINT "ClockGeolocationEvidence_clockEventId_fkey"
  FOREIGN KEY ("clockEventId") REFERENCES "ClockEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClockGeolocationEvidence"
  ADD CONSTRAINT "ClockGeolocationEvidence_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClockGeolocationEvidence"
  ADD CONSTRAINT "ClockGeolocationEvidence_attendanceExceptionId_fkey"
  FOREIGN KEY ("attendanceExceptionId") REFERENCES "AttendanceException"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockGeolocationEvidence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ClockGeolocationEvidence_select"
ON "ClockGeolocationEvidence"
FOR SELECT
USING (
  current_setting('app.is_admin', true) = 'true'
  OR EXISTS (
    SELECT 1
    FROM "ClockEvent" ce
    JOIN "Employment" e ON e.id = ce."employmentId"
    JOIN "Employee" employee ON employee.id = e."employeeId"
    WHERE ce.id = "ClockGeolocationEvidence"."clockEventId"
      AND employee."userId" = current_setting('app.current_user_id', true)
  )
);

CREATE POLICY "ClockGeolocationEvidence_insert"
ON "ClockGeolocationEvidence"
FOR INSERT
WITH CHECK (
  current_setting('app.is_admin', true) = 'true'
  OR EXISTS (
    SELECT 1
    FROM "ClockEvent" ce
    JOIN "Employment" e ON e.id = ce."employmentId"
    JOIN "Employee" employee ON employee.id = e."employeeId"
    WHERE ce.id = "ClockGeolocationEvidence"."clockEventId"
      AND employee."userId" = current_setting('app.current_user_id', true)
  )
);

CREATE POLICY "ClockGeolocationEvidence_update_admin"
ON "ClockGeolocationEvidence"
FOR UPDATE
USING (current_setting('app.is_admin', true) = 'true')
WITH CHECK (current_setting('app.is_admin', true) = 'true');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'maestro_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "ClockGeolocationEvidence" TO maestro_runtime;
  END IF;
END
$$;
