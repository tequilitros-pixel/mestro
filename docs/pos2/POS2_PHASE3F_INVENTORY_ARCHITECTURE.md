# POS 2.0 — Arquitectura Inventory Ledger V2 (Fase 3F)

## Fuente de verdad y frontera física

- Qué se vende: `PosProduct` / `PosProductVariant`.
- Qué existe físicamente: **exclusivamente `InventoryProduct`**.
- Historia V2: `InventoryMovement`, append-only.
- Proyección actual V2: `InventoryBalance`.
- Impacto futuro de una venta: Variant → `PosVariantIngredient` → `InventoryProduct`.

No existe `productId` ni `variantId` en Balance/Movement. `inventoryTracked` indica que una venta debe resolver impacto físico; nunca crea stock propio del producto comercial.

## Inventario legacy auditado

El balance visible hoy se calcula en `computeStockMatrix`: último `InventoryCount` CERRADO por Branch más suma de `InventoryEntry` posterior. Consumidores: administración de sucursales/analytics/notificaciones, entradas y conteos, ventas V1, eventos, embotellado y raw materials. `InventoryEntry` acepta deltas positivos/negativos y funciona como ledger parcial; `InventoryCount` reinicia baseline. Existen Float/number en consumidores y unidades legacy libres, por lo que no se hace cutover ni dual-write.

Eventos, paquetes y kits referencian `InventoryProduct`. Un kit es plantilla logística de componentes, no existencia física adicional. `ServiceEventItem` snapshottea el producto y cantidades; su puente futuro será EVENT_LOAD/RETURN, sin reescribir este módulo.

## Unidades: piezas frente a contenido

`InventoryProduct.inventoryBaseUnit` es nullable y requiere configuración explícita:

- UNIT: envase/pieza cerrada; cantidades enteras.
- ML: contenido consumible; Decimal.

Campos legacy (`handlingUnit`, `contentPerUnit`, `contentUnit`, `normalizedContentPerUnit`) se preservan como descripción/conversión, pero no se reinterpretan automáticamente. Diez botellas UNIT no equivalen automáticamente a 10,000 ML. Para consumir líquido abierto con precisión debe existir un `InventoryProduct` canónico ML o un futuro contrato explícito de apertura/conversión. Esto evita un Decimal con dos dimensiones ambiguas.

## Ledger, balance y locking

La clave de balance es UNIQUE Branch + InventoryProduct. Cada movimiento contiene delta firmado, unidad, before/after, tipo, source, documento/línea, actor, operationId y metadata. Trigger PostgreSQL prohíbe UPDATE/DELETE.

El command agrupa duplicados por InventoryProduct, ordena IDs, crea el balance con `INSERT ... ON CONFLICT DO NOTHING`, bloquea filas con `FOR UPDATE` en orden estable, valida todos los saldos y luego escribe. Un fallo revierte batch completo. Stock negativo está prohibido.

OperationReceipt hace idempotente la operación completa. Transfer adquiere locks advisory de ambas Branch+Product en orden lexicográfico y genera TRANSFER_OUT/IN atómicos.

## Counts, backfill y reconciliación

`InventoryCountDeclaration` conserva expected/declarado. La diferencia produce COUNT_CORRECTION; nunca se sobrescribe silenciosamente.

El backfill DEV calcula exactamente el balance legacy autorizado (último conteo cerrado + entradas posteriores) y crea un OPENING_BALANCE con evidencia `legacySource`, capturedAt y migrationVersion. Está bloqueado en `NODE_ENV=production`. `compareLegacyToV2` devuelve MATCH/MISMATCH sin corregir.

`ReconcileInventoryProduct/Branch` compara SUM(delta) contra Balance y nunca auto-repara.

## Mapa POS → físico

- DIRECT: variante con una ingredient line de ratio 1 hacia InventoryProduct.
- RECIPE: variante con una o varias ingredient lines.
- NON_TRACKED: producto `inventoryTracked=false`.
- UNCONFIGURED: `inventoryTracked=true` sin ingredients o línea Product sin mapping.

El modelo actual puede producir consumos por variante y cantidad, pero `PosVariantIngredient.quantity` no guarda unidad propia: sólo es seguro cuando el InventoryProduct destino tiene `inventoryBaseUnit` configurada y la cantidad ya está expresada en esa base. Éste es el gap principal antes de CompleteSale.

`ResolveOrderInventoryAvailability` agrupa recetas y balances en batch; es informativo, no reserva ni promete stock. Orders siguen sin escribir inventario.

## Tipos y evolución

Tipos implementados: OPENING_BALANCE, RECEIPT, SALE_CONSUMPTION/REVERSAL, TRANSFER_IN/OUT, ADJUSTMENT_IN/OUT, COUNT_CORRECTION y EVENT_LOAD/RETURN. Sale/Event son contratos preparados, no integraciones activas.

Cutover futuro: configurar unidades → snapshot legacy → OPENING_BALANCE → shadow reconciliation → dual validation → activar POS2 ledger → retirar legacy en fase separada. CompleteSale futuro bloqueará balances, validará receta/stock y escribirá Sale/Payment/Inventory/Cash/finalización Order en una transacción; no se implementa aquí.
