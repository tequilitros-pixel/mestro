-- La tabla PayrollSupplementRate puede existir ya en Neon por una publicación previa.
-- Este cambio solo registra su estructura en el historial actual de migraciones;
-- no modifica importes ni la nómina de ninguna semana aprobada.
CREATE TABLE IF NOT EXISTS "PayrollSupplementRate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "percent" DECIMAL(5,2) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollSupplementRate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayrollSupplementRate_userId_effectiveFrom_idx"
  ON "PayrollSupplementRate"("userId", "effectiveFrom");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollSupplementRate_userId_fkey') THEN
    ALTER TABLE "PayrollSupplementRate" ADD CONSTRAINT "PayrollSupplementRate_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollSupplementRate_createdById_fkey') THEN
    ALTER TABLE "PayrollSupplementRate" ADD CONSTRAINT "PayrollSupplementRate_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
