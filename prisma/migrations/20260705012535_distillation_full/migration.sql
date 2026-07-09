/*
  Warnings:

  - You are about to drop the column `alcohol` on the `Distillation` table. All the data in the column will be lost.
  - You are about to drop the column `heads` on the `Distillation` table. All the data in the column will be lost.
  - You are about to drop the column `heart` on the `Distillation` table. All the data in the column will be lost.
  - You are about to drop the column `tails` on the `Distillation` table. All the data in the column will be lost.
  - Added the required column `loadedLiters` to the `Distillation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "DistillationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "distillationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "temperature" REAL,
    "alcohol" REAL,
    "liters" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistillationEvent_distillationId_fkey" FOREIGN KEY ("distillationId") REFERENCES "Distillation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Distillation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "loadedLiters" REAL NOT NULL,
    "initialAlcohol" REAL,
    "headsLiters" REAL,
    "heartLiters" REAL,
    "tailsLiters" REAL,
    "finalAlcohol" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVA',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Distillation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Distillation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Distillation" ("createdAt", "equipmentId", "finishedAt", "id", "lotId", "startedAt", "status", "type", "updatedAt") SELECT "createdAt", "equipmentId", "finishedAt", "id", "lotId", "startedAt", "status", "type", "updatedAt" FROM "Distillation";
DROP TABLE "Distillation";
ALTER TABLE "new_Distillation" RENAME TO "Distillation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
