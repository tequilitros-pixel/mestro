-- AlterTable
ALTER TABLE "DistillationEvent" ADD COLUMN "alcoholCorrected" REAL;
ALTER TABLE "DistillationEvent" ADD COLUMN "outputTemperature" REAL;

-- AlterTable
ALTER TABLE "FermentationReading" ADD COLUMN "saccharometer" REAL;
