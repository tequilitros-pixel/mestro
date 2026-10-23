CREATE TYPE "CashTransferEndpointType" AS ENUM ('CASH_SESSION', 'ENVELOPE');
CREATE TABLE "CashTransfer" (
  "id" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "branchId" TEXT NOT NULL,
  "sourceType" "CashTransferEndpointType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "destinationType" "CashTransferEndpointType" NOT NULL,
  "destinationId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashTransfer_operationId_key" ON "CashTransfer"("operationId");
CREATE INDEX "CashTransfer_branchId_createdAt_idx" ON "CashTransfer"("branchId", "createdAt");
CREATE INDEX "CashTransfer_sourceType_sourceId_idx" ON "CashTransfer"("sourceType", "sourceId");
CREATE INDEX "CashTransfer_destinationType_destinationId_idx" ON "CashTransfer"("destinationType", "destinationId");
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
