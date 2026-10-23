CREATE TABLE "TimeClockLocationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "TimeClockEditStatus" NOT NULL DEFAULT 'PENDIENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "timeClockId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeClockLocationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimeClockLocationRequest_timeClockId_key" ON "TimeClockLocationRequest"("timeClockId");
CREATE INDEX "TimeClockLocationRequest_userId_status_clockOut_idx" ON "TimeClockLocationRequest"("userId", "status", "clockOut");
CREATE INDEX "TimeClockLocationRequest_status_createdAt_idx" ON "TimeClockLocationRequest"("status", "createdAt");
CREATE INDEX "TimeClockLocationRequest_branchId_createdAt_idx" ON "TimeClockLocationRequest"("branchId", "createdAt");

ALTER TABLE "TimeClockLocationRequest" ADD CONSTRAINT "TimeClockLocationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeClockLocationRequest" ADD CONSTRAINT "TimeClockLocationRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeClockLocationRequest" ADD CONSTRAINT "TimeClockLocationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeClockLocationRequest" ADD CONSTRAINT "TimeClockLocationRequest_timeClockId_fkey" FOREIGN KEY ("timeClockId") REFERENCES "TimeClockEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
