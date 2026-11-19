-- Accumulate destrozado volumes by production lot before rectification.
CREATE TYPE "DistillationReceiverStatus" AS ENUM ('OPEN', 'READY');

CREATE TABLE "DistillationReceiver" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityLiters" DOUBLE PRECISION NOT NULL,
    "status" "DistillationReceiverStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    CONSTRAINT "DistillationReceiver_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DistillationReceiver_capacity_positive" CHECK ("capacityLiters" > 0)
);
CREATE UNIQUE INDEX "DistillationReceiver_lotId_name_key" ON "DistillationReceiver"("lotId", "name");
CREATE INDEX "DistillationReceiver_status_idx" ON "DistillationReceiver"("status");
ALTER TABLE "DistillationReceiver" ADD CONSTRAINT "DistillationReceiver_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Distillation" ADD COLUMN "plannedReceiverId" TEXT;
ALTER TABLE "Distillation" ADD COLUMN "sourceReceiverId" TEXT;
CREATE INDEX "Distillation_sourceReceiverId_idx" ON "Distillation"("sourceReceiverId");
CREATE INDEX "Distillation_plannedReceiverId_idx" ON "Distillation"("plannedReceiverId");
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_plannedReceiverId_fkey" FOREIGN KEY ("plannedReceiverId") REFERENCES "DistillationReceiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Distillation" ADD CONSTRAINT "Distillation_sourceReceiverId_fkey" FOREIGN KEY ("sourceReceiverId") REFERENCES "DistillationReceiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DistillationReceiverTransfer" (
    "id" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "distillationId" TEXT NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "alcohol" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistillationReceiverTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DistillationReceiverTransfer_liters_positive" CHECK ("liters" > 0)
);
CREATE UNIQUE INDEX "DistillationReceiverTransfer_distillationId_key" ON "DistillationReceiverTransfer"("distillationId");
CREATE INDEX "DistillationReceiverTransfer_receiverId_idx" ON "DistillationReceiverTransfer"("receiverId");
ALTER TABLE "DistillationReceiverTransfer" ADD CONSTRAINT "DistillationReceiverTransfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "DistillationReceiver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistillationReceiverTransfer" ADD CONSTRAINT "DistillationReceiverTransfer_distillationId_fkey" FOREIGN KEY ("distillationId") REFERENCES "Distillation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
