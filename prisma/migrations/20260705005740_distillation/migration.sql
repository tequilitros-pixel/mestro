-- CreateTable
CREATE TABLE "Fermentation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "tank" TEXT NOT NULL,
    "mustLiters" REAL NOT NULL,
    "initialBrix" REAL NOT NULL,
    "initialPh" REAL NOT NULL,
    "initialTemperature" REAL NOT NULL,
    "yeast" TEXT,
    "inoculatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fermentation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FermentationReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fermentationId" TEXT NOT NULL,
    "brix" REAL,
    "ph" REAL,
    "temperature" REAL,
    "alcohol" REAL,
    "citricAcidGrams" REAL,
    "bicarbonateGrams" REAL,
    "heated" BOOLEAN NOT NULL DEFAULT false,
    "heatingMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FermentationReading_fermentationId_fkey" FOREIGN KEY ("fermentationId") REFERENCES "Fermentation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Distillation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "heads" REAL,
    "heart" REAL,
    "tails" REAL,
    "alcohol" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Distillation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Distillation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
