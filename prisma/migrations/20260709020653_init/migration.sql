-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('HORNO', 'DESGARRADORA', 'PRENSA', 'TINA', 'ALAMBIQUE', 'BOMBA', 'TANQUE', 'CALDERA', 'OTRO');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('DISPONIBLE', 'OPERANDO', 'ESPERANDO', 'LAVADO', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "LotStage" AS ENUM ('RECEPCION', 'COCCION', 'MOLIENDA', 'FERMENTACION', 'DESTILACION', 'RECTIFICACION', 'TERMINADO');

-- CreateEnum
CREATE TYPE "CookingStatus" AS ENUM ('ACTIVA', 'PAUSADA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "CookingEventType" AS ENUM ('INICIO_COCCION', 'INICIO_VAPOR', 'TEMPERATURA', 'MIELES_AMARGAS', 'MIELES_DULCES', 'BAJAR_VAPOR', 'AUMENTAR_VAPOR', 'SUSPENDER_VAPOR', 'FIN_COCCION', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "MillingStatus" AS ENUM ('ACTIVA', 'PAUSADA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "MillingEventType" AS ENUM ('INICIO_MOLIENDA', 'REGISTRO_BRIX', 'REGISTRO_PH', 'REGISTRO_TEMPERATURA', 'AGREGAR_AGUA', 'CAMBIO_PRENSA', 'LAVADO_BAGAZO', 'REGISTRO_BAGAZO', 'FIN_MOLIENDA', 'OBSERVACION');

-- CreateEnum
CREATE TYPE "FermentationStatus" AS ENUM ('ACTIVA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "DistillationStatus" AS ENUM ('ACTIVA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "DistillationType" AS ENUM ('DESTROZADO', 'RECTIFICACION');

-- CreateEnum
CREATE TYPE "DistillationEventType" AS ENUM ('INICIO_CALENTAMIENTO', 'TEMPERATURA', 'ALCOHOL', 'LITROS', 'CORTE_CABEZAS', 'INICIO_CORAZON', 'FIN_CORAZON', 'INICIO_COLAS', 'FIN_DESTILACION', 'OBSERVACION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "capacity" DOUBLE PRECISION NOT NULL,
    "currentLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" "LotStage" NOT NULL,
    "agaveKg" DOUBLE PRECISION NOT NULL,
    "art" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooking" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "agaveKg" DOUBLE PRECISION NOT NULL,
    "status" "CookingStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingEvent" (
    "id" TEXT NOT NULL,
    "cookingId" TEXT NOT NULL,
    "type" "CookingEventType" NOT NULL,
    "temperatureTop" DOUBLE PRECISION,
    "temperatureMiddle" DOUBLE PRECISION,
    "temperatureBottom" DOUBLE PRECISION,
    "liters" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milling" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" "MillingStatus" NOT NULL DEFAULT 'ACTIVA',
    "operator" TEXT,
    "cookedKg" DOUBLE PRECISION NOT NULL,
    "waterLiters" DOUBLE PRECISION,
    "mashLiters" DOUBLE PRECISION,
    "bagasseKg" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "pressPasses" INTEGER,
    "washBagasse" BOOLEAN NOT NULL DEFAULT false,
    "washRecoveredLiters" DOUBLE PRECISION,
    "observations" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillingEvent" (
    "id" TEXT NOT NULL,
    "millingId" TEXT NOT NULL,
    "type" "MillingEventType" NOT NULL,
    "value" DOUBLE PRECISION,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "waterLiters" DOUBLE PRECISION,
    "bagasseKg" DOUBLE PRECISION,
    "washRecoveredLiters" DOUBLE PRECISION,
    "pressPasses" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fermentation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "tank" TEXT NOT NULL,
    "mustLiters" DOUBLE PRECISION NOT NULL,
    "initialBrix" DOUBLE PRECISION NOT NULL,
    "initialPh" DOUBLE PRECISION NOT NULL,
    "initialTemperature" DOUBLE PRECISION NOT NULL,
    "yeast" TEXT,
    "inoculatedAt" TIMESTAMP(3) NOT NULL,
    "status" "FermentationStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fermentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermentationReading" (
    "id" TEXT NOT NULL,
    "fermentationId" TEXT NOT NULL,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "saccharometer" DOUBLE PRECISION,
    "citricAcidGrams" DOUBLE PRECISION,
    "bicarbonateGrams" DOUBLE PRECISION,
    "heated" BOOLEAN NOT NULL DEFAULT false,
    "heatingMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FermentationReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distillation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" "DistillationType" NOT NULL,
    "loadedLiters" DOUBLE PRECISION NOT NULL,
    "initialAlcohol" DOUBLE PRECISION,
    "headsLiters" DOUBLE PRECISION,
    "heartLiters" DOUBLE PRECISION,
    "tailsLiters" DOUBLE PRECISION,
    "finalAlcohol" DOUBLE PRECISION,
    "status" "DistillationStatus" NOT NULL DEFAULT 'ACTIVA',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distillation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistillationEvent" (
    "id" TEXT NOT NULL,
    "distillationId" TEXT NOT NULL,
    "type" "DistillationEventType" NOT NULL,
    "temperature" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "liters" DOUBLE PRECISION,
    "outputTemperature" DOUBLE PRECISION,
    "alcoholCorrected" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistillationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotExpense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "LotExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_code_key" ON "Lot"("code");

-- CreateIndex
CREATE INDEX "LotExpense_lotId_idx" ON "LotExpense"("lotId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooking" ADD CONSTRAINT "Cooking_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cooking" ADD CONSTRAINT "Cooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingEvent" ADD CONSTRAINT "CookingEvent_cookingId_fkey" FOREIGN KEY ("cookingId") REFERENCES "Cooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milling" ADD CONSTRAINT "Milling_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milling" ADD CONSTRAINT "Milling_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingEvent" ADD CONSTRAINT "MillingEvent_millingId_fkey" FOREIGN KEY ("millingId") REFERENCES "Milling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fermentation" ADD CONSTRAINT "Fermentation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FermentationReading" ADD CONSTRAINT "FermentationReading_fermentationId_fkey" FOREIGN KEY ("fermentationId") REFERENCES "Fermentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistillationEvent" ADD CONSTRAINT "DistillationEvent_distillationId_fkey" FOREIGN KEY ("distillationId") REFERENCES "Distillation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotExpense" ADD CONSTRAINT "LotExpense_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
