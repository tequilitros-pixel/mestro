-- CreateTable
CREATE TABLE "Milling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "operator" TEXT,
    "cookedKg" REAL NOT NULL,
    "waterLiters" REAL,
    "mashLiters" REAL,
    "bagasseKg" REAL,
    "brix" REAL,
    "ph" REAL,
    "temperature" REAL,
    "pressPasses" INTEGER,
    "washBagasse" BOOLEAN NOT NULL DEFAULT false,
    "washRecoveredLiters" REAL,
    "observations" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milling_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Milling_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "millingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MillingEvent_millingId_fkey" FOREIGN KEY ("millingId") REFERENCES "Milling" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
