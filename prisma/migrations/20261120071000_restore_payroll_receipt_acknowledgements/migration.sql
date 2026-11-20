-- No modifica recibos ni firmas anteriores. Las columnas ya existen
-- en la base operativa y se documentan para futuras instalaciones.
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "signedByName" TEXT;
