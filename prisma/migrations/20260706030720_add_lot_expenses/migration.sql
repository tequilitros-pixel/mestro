-- CreateTable
CREATE TABLE "LotExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    CONSTRAINT "LotExpense_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LotExpense_lotId_idx" ON "LotExpense"("lotId");
