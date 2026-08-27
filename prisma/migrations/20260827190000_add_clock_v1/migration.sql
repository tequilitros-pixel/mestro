-- ADD_MISSING_EVENT corrections need an explicit working branch because they
-- do not target an observed ClockEvent from which branch can be recovered.
ALTER TABLE "ClockCorrection" ADD COLUMN "branchId" TEXT;
CREATE INDEX "ClockCorrection_branchId_requestedAt_idx" ON "ClockCorrection"("branchId", "requestedAt");
ALTER TABLE "ClockCorrection" ADD CONSTRAINT "ClockCorrection_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ClockEvent is the immutable observation ledger. Corrections are separate
-- facts; derived WorkSession rows remain rebuildable.
CREATE OR REPLACE FUNCTION "workforce_clock_event_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ClockEvent is append-only; use ClockCorrection';
END;
$$;

CREATE TRIGGER "ClockEvent_block_update"
BEFORE UPDATE ON "ClockEvent"
FOR EACH ROW EXECUTE FUNCTION "workforce_clock_event_append_only"();

CREATE TRIGGER "ClockEvent_block_delete"
BEFORE DELETE ON "ClockEvent"
FOR EACH ROW EXECUTE FUNCTION "workforce_clock_event_append_only"();
