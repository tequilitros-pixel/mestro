-- La producción ya conserva conteos anulados. Alinea instalaciones nuevas y
-- existentes sin modificar ningún registro histórico.
ALTER TYPE "InventoryCountStatus" ADD VALUE IF NOT EXISTS 'ANULADO';
