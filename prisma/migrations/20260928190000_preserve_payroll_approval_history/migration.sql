-- Conservar cada aprobación individual aunque se reabra la semana.
CREATE TABLE "PayrollEntryApproval" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "approvedById" TEXT,
  "approvedByName" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL,
  "totalPay" DECIMAL(12,2) NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "PayrollEntryApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollEntryApproval_entryId_revision_key"
  ON "PayrollEntryApproval"("entryId", "revision");
CREATE INDEX "PayrollEntryApproval_entryId_idx"
  ON "PayrollEntryApproval"("entryId");

ALTER TABLE "PayrollEntryApproval"
  ADD CONSTRAINT "PayrollEntryApproval_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "PayrollEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las aprobaciones productivas existentes son la primera revisión histórica.
INSERT INTO "PayrollEntryApproval" (
  "id", "entryId", "revision", "approvedById", "approvedByName",
  "approvedAt", "totalPay", "snapshot"
)
SELECT
  'legacy_' || entry."id",
  entry."id",
  1,
  entry."approvedById",
  COALESCE(approver."name", 'Aprobación anterior'),
  COALESCE(entry."approvedAt", entry."createdAt"),
  entry."totalPay",
  jsonb_build_object(
    'hourlyRate', entry."hourlyRate",
    'regularHours', entry."regularHours",
    'overtimeHours', entry."overtimeHours",
    'totalHours', entry."totalHours",
    'basePay', entry."basePay",
    'overtimePay', entry."overtimePay",
    'adjustmentsTotal', entry."adjustmentsTotal",
    'totalPay', entry."totalPay",
    'hoursByDay', entry."hoursByDay",
    'daysSnapshot', entry."daysSnapshot",
    'adjustmentsSnapshot', entry."adjustmentsSnapshot"
  )
FROM "PayrollEntry" entry
LEFT JOIN "User" approver ON approver."id" = entry."approvedById"
WHERE entry."status" IN ('APROBADA', 'PAGADA');

ALTER TABLE "PayrollEntryApproval" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'maestro_runtime') THEN
    GRANT SELECT, INSERT ON TABLE "PayrollEntryApproval" TO maestro_runtime;
    CREATE POLICY payroll_entry_approval_admin ON "PayrollEntryApproval"
      TO maestro_runtime
      USING (current_setting('app.is_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_admin', true) = 'true');
  END IF;
END $$;
