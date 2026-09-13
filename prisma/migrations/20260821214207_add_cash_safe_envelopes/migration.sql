-- CreateEnum
CREATE TYPE "CashSafeEnvelopeStatus" AS ENUM ('PENDIENTE', 'EN_CAJA_FUERTE', 'PARCIAL', 'VACIO');

-- CreateEnum
CREATE TYPE "CashSafeEnvelopeMovementType" AS ENUM ('INGRESO', 'RECEPCION', 'RETIRO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO');

-- CreateTable
CREATE TABLE "CashSafeEnvelope" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashCutId" TEXT NOT NULL,
    "cutDate" TIMESTAMP(3) NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "status" "CashSafeEnvelopeStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedAmount" DOUBLE PRECISION,

    CONSTRAINT "CashSafeEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSafeEnvelopeMovement" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "type" "CashSafeEnvelopeMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "cashCutId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashSafeEnvelopeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashSafeEnvelope_code_key" ON "CashSafeEnvelope"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CashSafeEnvelope_cashCutId_key" ON "CashSafeEnvelope"("cashCutId");

-- CreateIndex
CREATE INDEX "CashSafeEnvelope_branchId_idx" ON "CashSafeEnvelope"("branchId");

-- CreateIndex
CREATE INDEX "CashSafeEnvelope_status_idx" ON "CashSafeEnvelope"("status");

-- CreateIndex
CREATE INDEX "CashSafeEnvelope_cutDate_idx" ON "CashSafeEnvelope"("cutDate");

-- CreateIndex
CREATE INDEX "CashSafeEnvelopeMovement_envelopeId_idx" ON "CashSafeEnvelopeMovement"("envelopeId");

-- CreateIndex
CREATE INDEX "CashSafeEnvelopeMovement_cashCutId_idx" ON "CashSafeEnvelopeMovement"("cashCutId");

-- CreateIndex
CREATE INDEX "CashSafeEnvelopeMovement_type_idx" ON "CashSafeEnvelopeMovement"("type");

-- AddForeignKey
ALTER TABLE "CashSafeEnvelope" ADD CONSTRAINT "CashSafeEnvelope_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelope" ADD CONSTRAINT "CashSafeEnvelope_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelope" ADD CONSTRAINT "CashSafeEnvelope_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelope" ADD CONSTRAINT "CashSafeEnvelope_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelopeMovement" ADD CONSTRAINT "CashSafeEnvelopeMovement_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "CashSafeEnvelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelopeMovement" ADD CONSTRAINT "CashSafeEnvelopeMovement_cashCutId_fkey" FOREIGN KEY ("cashCutId") REFERENCES "CashCut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSafeEnvelopeMovement" ADD CONSTRAINT "CashSafeEnvelopeMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
