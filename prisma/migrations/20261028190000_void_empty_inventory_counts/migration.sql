-- Anular conserva el registro y su responsable, pero libera la sucursal para
-- iniciar otro conteo. Sólo la aplicación permite anular borradores sin
-- cantidades capturadas; no se eliminan conteos ni movimientos históricos.
ALTER TYPE "InventoryCountStatus" ADD VALUE IF NOT EXISTS 'ANULADO';

ALTER TABLE "InventoryCount"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT;

CREATE INDEX "InventoryCount_voidedById_idx" ON "InventoryCount"("voidedById");

ALTER TABLE "InventoryCount"
  ADD CONSTRAINT "InventoryCount_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
