-- CreateEnum
CREATE TYPE "PublicQrStatus" AS ENUM ('BORRADOR', 'PUBLICADO', 'ARCHIVADO');

-- CreateTable
CREATE TABLE "PublicQrProfile" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "batchId" TEXT,
    "createdById" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "lotCode" TEXT,
    "payload" JSONB NOT NULL,
    "visibility" JSONB NOT NULL,
    "status" "PublicQrStatus" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicQrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicQrAuditEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicQrAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicQrProfile_publicId_key" ON "PublicQrProfile"("publicId");
CREATE INDEX "PublicQrProfile_batchId_idx" ON "PublicQrProfile"("batchId");
CREATE INDEX "PublicQrProfile_status_idx" ON "PublicQrProfile"("status");
CREATE INDEX "PublicQrProfile_createdById_idx" ON "PublicQrProfile"("createdById");
CREATE INDEX "PublicQrAuditEvent_profileId_createdAt_idx" ON "PublicQrAuditEvent"("profileId", "createdAt");
CREATE INDEX "PublicQrAuditEvent_userId_idx" ON "PublicQrAuditEvent"("userId");

-- CreateForeignKey
ALTER TABLE "PublicQrProfile" ADD CONSTRAINT "PublicQrProfile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LiquorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicQrAuditEvent" ADD CONSTRAINT "PublicQrAuditEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PublicQrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
