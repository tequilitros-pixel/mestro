-- CreateTable
CREATE TABLE "Cooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "agaveKg" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cooking_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CookingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "temperatureTop" REAL,
    "temperatureMiddle" REAL,
    "temperatureBottom" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CookingEvent_cookingId_fkey" FOREIGN KEY ("cookingId") REFERENCES "Cooking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
