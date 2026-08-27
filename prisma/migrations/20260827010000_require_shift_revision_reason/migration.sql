-- Every ShiftRevision is an audit snapshot. A reason is required so a
-- published change always preserves why it was made. DEV was verified to
-- contain no existing ShiftRevision rows before this constraint was added.
ALTER TABLE "ShiftRevision"
ALTER COLUMN "reason" SET NOT NULL;
