CREATE TYPE "PayrollEntryStatus" AS ENUM ('REVISION', 'APROBADA', 'PAGADA');

ALTER TABLE "PayrollEntry"
  ADD COLUMN "status" "PayrollEntryStatus" NOT NULL DEFAULT 'REVISION',
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "PayrollEntry" entry
SET
  "status" = CASE
    WHEN period."status" = 'PAGADA' THEN 'PAGADA'::"PayrollEntryStatus"
    WHEN period."status" = 'APROBADA' THEN 'APROBADA'::"PayrollEntryStatus"
    ELSE 'REVISION'::"PayrollEntryStatus"
  END,
  "approvedById" = CASE
    WHEN period."status" IN ('APROBADA', 'PAGADA') THEN period."approvedById"
    ELSE NULL
  END,
  "approvedAt" = CASE
    WHEN period."status" IN ('APROBADA', 'PAGADA') THEN period."approvedAt"
    ELSE NULL
  END
FROM "PayrollPeriod" period
WHERE entry."periodId" = period."id";

CREATE INDEX "PayrollEntry_periodId_status_idx" ON "PayrollEntry"("periodId", "status");

ALTER TABLE "PayrollEntry"
  ADD CONSTRAINT "PayrollEntry_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

