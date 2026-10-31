-- Corrige sólo la presentación comercial de los dos vasos confirmados.
-- Las cantidades en UNIT y los movimientos permanecen intactos.
DO $$
DECLARE
  cup RECORD;
  changed_count INTEGER := 0;
BEGIN
  FOR cup IN
    SELECT id, code, name, "handlingUnit"::text AS previous_handling
    FROM "InventoryProduct"
    WHERE code IN ('POS-ING-VASO-GDE', 'POS-ING-VASO-MED')
    FOR UPDATE
  LOOP
    IF cup.previous_handling <> 'PIEZA'
      OR NOT EXISTS (
        SELECT 1 FROM "InventoryProduct" p
        WHERE p.id = cup.id
          AND p."inventoryBaseUnit" = 'UNIT'
          AND p."contentUnit" = 'PIEZAS'
          AND p."contentPerUnit" = 25
          AND p."normalizedContentPerUnit" = 25
      ) THEN
      RAISE EXCEPTION 'La configuración de % cambió; requiere revisión manual', cup.code;
    END IF;

    UPDATE "InventoryProduct"
    SET "handlingUnit" = 'PAQUETE', "updatedAt" = NOW()
    WHERE id = cup.id;

    INSERT INTO "AuditEvent" (id, action, "entityType", "entityId", metadata, "createdAt")
    VALUES (
      gen_random_uuid()::text,
      'INVENTORY_CUP_PRESENTATION_RESTORED',
      'InventoryProduct',
      cup.id,
      jsonb_build_object(
        'code', cup.code,
        'name', cup.name,
        'previousHandlingUnit', cup.previous_handling,
        'handlingUnit', 'PAQUETE',
        'piecesPerPackage', 25,
        'baseUnit', 'UNIT'
      ),
      NOW()
    );
    changed_count := changed_count + 1;
  END LOOP;

  IF changed_count <> 2 THEN
    RAISE EXCEPTION 'Se esperaban dos productos de vasos; encontrados %', changed_count;
  END IF;
END $$;
