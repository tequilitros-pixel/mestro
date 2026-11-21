-- One-time, audited transfer of the 23 recorded Canoas balances into V2.
-- Run on a current Neon branch first, then production. This is a ledger
-- opening from historical COMPRA entries, not a physical inventory count.
-- Any changed source quantity or unexpected legacy balance aborts the whole transaction.
DO $cutover$
DECLARE
  migration_version constant text := 'stock-v2-cutover-20261029';
  expected jsonb := '{
    "EQ-AGITADOR": 6, "EQ-CABALLITO": 52, "EQ-CUBETA": 3,
    "EQ-CUCHARON-HIELO": 6, "EQ-CUCHILLO": 5, "EQ-ENCENDEDOR": 50,
    "EQ-ESCARCHADOR": 14, "EQ-EXPRIMIDOR": 3, "EQ-HIELERA": 3,
    "EQ-HIELERA-GRANDE": 2, "EQ-JARRA": 11, "EQ-JIGGER": 4,
    "EQ-LONA": 4, "EQ-MAMILA": 20, "EQ-MENU": 17,
    "EQ-MESA": 9, "EQ-POPOTERO": 3, "EQ-PORTAAGITADOR": 3,
    "EQ-SALERO": 6, "EQ-SERVILLETERO": 2, "EQ-TABLA-CORTAR": 3,
    "EQ-TRAPO": 3, "LIMON": 80
  }'::jsonb;
  target_branch_id text;
  item record;
  product_id text;
  base_unit text;
  product_unit text;
  factor numeric;
  historical_quantity numeric;
  entry_ids text[];
  entry_count integer;
  closed_count_count integer;
  unexpected_nonzero integer;
  expected_count integer;
  balance_id text;
  movement_id text;
  operation_id uuid;
  base_quantity numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(migration_version, 0));
  SELECT id INTO STRICT target_branch_id FROM "Branch" WHERE code = 'CANOAS' AND active;

  -- The preview inventory found exactly these 23 positive, uninitialized pairs.
  WITH missing AS (
    SELECT b.id AS branch_id, p.id AS product_id, coalesce(lc.quantity, 0) + coalesce(le.quantity, 0) AS quantity
    FROM "Branch" b CROSS JOIN "InventoryProduct" p
    LEFT JOIN "InventoryBalance" ib ON ib."branchId" = b.id AND ib."inventoryProductId" = p.id
    LEFT JOIN LATERAL (
      SELECT ci."quantityCounted" AS quantity, c."countDate"
      FROM "InventoryCountItem" ci JOIN "InventoryCount" c ON c.id = ci."countId"
      WHERE c."branchId" = b.id AND ci."productId" = p.id AND c.status = 'CERRADO'
      ORDER BY c."countDate" DESC, c.id DESC LIMIT 1
    ) lc ON true
    LEFT JOIN LATERAL (
      SELECT sum(e.quantity) AS quantity FROM "InventoryEntry" e
      WHERE e."branchId" = b.id AND e."productId" = p.id
        AND e."entryDate" > coalesce(lc."countDate", 'epoch'::timestamp)
    ) le ON true
    WHERE b.active AND p."isActive" AND p."trackStock" AND p."archivedAt" IS NULL AND ib.id IS NULL
  )
  SELECT count(*) INTO unexpected_nonzero FROM missing WHERE quantity <> 0;
  SELECT count(*) INTO expected_count FROM jsonb_object_keys(expected);
  IF unexpected_nonzero <> 23 OR expected_count <> 23 THEN
    RAISE EXCEPTION 'Legacy stock changed: expected 23 nonzero pairs, got %', unexpected_nonzero;
  END IF;

  FOR item IN SELECT key AS code, value::numeric AS expected_quantity FROM jsonb_each_text(expected) ORDER BY key LOOP
    SELECT p.id, p."inventoryBaseUnit"::text, p.unit,
      CASE WHEN p."inventoryBaseUnit" = 'UNIT' THEN 1::numeric ELSE p."normalizedContentPerUnit" END
      INTO STRICT product_id, base_unit, product_unit, factor
      FROM "InventoryProduct" p
      WHERE p.code = item.code AND p."isActive" AND p."trackStock" AND p."archivedAt" IS NULL
      FOR UPDATE;
    PERFORM pg_advisory_xact_lock(hashtextextended(target_branch_id || ':' || product_id, 0));
    IF EXISTS (SELECT 1 FROM "InventoryBalance" WHERE "branchId" = target_branch_id AND "inventoryProductId" = product_id) THEN
      RAISE EXCEPTION 'V2 balance already exists for %', item.code;
    END IF;
    SELECT count(*) INTO closed_count_count
      FROM "InventoryCountItem" ci JOIN "InventoryCount" c ON c.id = ci."countId"
      WHERE c."branchId" = target_branch_id AND ci."productId" = product_id AND c.status = 'CERRADO';
    IF closed_count_count <> 0 THEN RAISE EXCEPTION 'Closed count now exists for %', item.code; END IF;
    SELECT coalesce(sum(e.quantity), 0), array_agg(e.id ORDER BY e."entryDate", e.id), count(*)
      INTO historical_quantity, entry_ids, entry_count
      FROM "InventoryEntry" e WHERE e."branchId" = target_branch_id AND e."productId" = product_id;
    IF historical_quantity <> item.expected_quantity OR entry_count = 0 THEN
      RAISE EXCEPTION 'Historical quantity changed for %: expected %, got %', item.code, item.expected_quantity, historical_quantity;
    END IF;
    IF EXISTS (SELECT 1 FROM "InventoryEntry" e WHERE e."branchId" = target_branch_id AND e."productId" = product_id
      AND (e.type <> 'COMPRA' OR e."contentPerUnit" IS NOT NULL OR e."contentUnit" IS NOT NULL)) THEN
      RAISE EXCEPTION 'Unreviewed historical entry for %', item.code;
    END IF;
    IF item.code = 'LIMON' THEN
      IF base_unit <> 'G' OR lower(product_unit) <> 'kilogramo' OR factor <> 1000 THEN
        RAISE EXCEPTION 'Lemon unit conversion changed';
      END IF;
    ELSIF base_unit <> 'UNIT' OR factor <> 1 THEN
      RAISE EXCEPTION 'Equipment unit conversion changed for %', item.code;
    END IF;
    base_quantity := historical_quantity * factor;
    balance_id := gen_random_uuid()::text;
    movement_id := gen_random_uuid()::text;
    operation_id := gen_random_uuid();
    INSERT INTO "InventoryBalance" (id, "branchId", "inventoryProductId", quantity, unit, version, "createdAt", "updatedAt")
      VALUES (balance_id, target_branch_id, product_id, base_quantity, base_unit::"CatalogBaseUnit", 1, now(), now());
    INSERT INTO "InventoryMovement" (id, "branchId", "inventoryProductId", "movementType", "quantityDelta", unit,
      "balanceBefore", "balanceAfter", "sourceType", "sourceId", "actorId", "operationId", "reasonCode", metadata, "createdAt")
      VALUES (movement_id, target_branch_id, product_id, 'OPENING_BALANCE', base_quantity, base_unit::"CatalogBaseUnit",
        0, base_quantity, 'LEGACY_OPENING', migration_version || ':' || item.code, 'system:stock-v2-cutover', operation_id,
        'RECORDED_LEGACY_OPENING', jsonb_build_object('migrationVersion', migration_version, 'legacyEntryIds', entry_ids,
          'legacyQuantity', historical_quantity, 'legacyUnit', product_unit, 'factorToBase', factor,
          'physicalCount', false, 'source', 'reviewed InventoryEntry COMPRA records'), now());
    INSERT INTO "AuditEvent" (id, "branchId", action, "entityType", "entityId", "operationId", metadata, "createdAt")
      VALUES (gen_random_uuid()::text, target_branch_id, 'INVENTORY_LEGACY_OPENING_CAPTURED', 'InventoryBalance', balance_id,
        operation_id, jsonb_build_object('migrationVersion', migration_version, 'productCode', item.code,
          'legacyEntryIds', entry_ids, 'baseQuantity', base_quantity, 'unit', base_unit, 'physicalCount', false), now());
  END LOOP;
END
$cutover$;
