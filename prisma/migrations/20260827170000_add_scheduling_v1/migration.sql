-- Scheduling V1 permits coverage needs without an assigned Employee while a
-- week is being drafted. Published snapshots preserve that nullable state.
ALTER TABLE "Shift" ALTER COLUMN "employmentId" DROP NOT NULL;
ALTER TABLE "ShiftRevision" ALTER COLUMN "employmentId" DROP NOT NULL;

-- Date-specific manual staffing target. This is deliberately not forecasting
-- and does not replace or modify any legacy scheduling model.
CREATE TABLE "StaffingRequirement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffingRequirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StaffingRequirement_requiredCount_check" CHECK ("requiredCount" > 0),
    CONSTRAINT "StaffingRequirement_time_check" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "startTime" <> "endTime")
);

CREATE UNIQUE INDEX "StaffingRequirement_branchId_businessDate_startTime_endTime_key" ON "StaffingRequirement"("branchId", "businessDate", "startTime", "endTime");
CREATE INDEX "StaffingRequirement_branchId_businessDate_idx" ON "StaffingRequirement"("branchId", "businessDate");

ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
