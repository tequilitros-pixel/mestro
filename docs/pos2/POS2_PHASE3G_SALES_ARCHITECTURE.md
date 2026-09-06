# POS 2.0 — Fase 3G: Sale V2, Payment V2 y CompleteSale

## Decisiones

`PosVariantIngredient.quantity` ya no se interpreta sin dimensión. Cada línea incorpora `unit` (`UNIT`/`ML`) y `unitStatus` (`RESOLVED`/`UNRESOLVED`). El backfill solo usa `InventoryProduct.inventoryBaseUnit` cuando está explícitamente configurado. Las demás líneas quedan sin resolver y `CompleteSale` las rechaza.

`Pos2Sale`, `Pos2SaleLine` y `Pos2Payment` son hechos financieros inmutables separados del POS legacy. PostgreSQL rechaza UPDATE/DELETE, garantiza una Sale por Order y valida importes, objetivos exclusivos de línea y efectivo entregado/cambio.

## Frontera transaccional

`CompleteSale` usa una sola transacción idempotente:

1. bloquea Order (`FOR UPDATE`) y exige `PAYMENT_PENDING` y versión esperada;
2. autoriza actor, terminal y capabilities de venta/método;
3. bloquea CashSession y exige `OPEN` en la misma Branch/Register;
4. revalida catálogo y la misma PriceVersion/importe;
5. valida pagos exactos y resuelve receta con unidades explícitas;
6. crea Sale, snapshots de líneas y Payments;
7. agrupa y aplica consumos al ledger de InventoryProduct bajo locks ordenados;
8. crea un único CashMovement `SALE_CASH` por el importe aplicado en efectivo, no por el tender;
9. finaliza Order, y agrega auditoría/outbox.

Cualquier error revierte OperationReceipt, Sale, Payments, InventoryMovement/Balance, CashMovement, Order, auditoría y outbox.

## Locks y concurrencia

El orden es Order → CashSession → InventoryBalance ordenado por InventoryProduct. Cierre y movimientos manuales serializan en CashSession. El cierre rechaza mientras exista cualquier Order `PAYMENT_PENDING`; una venta ya serializada queda incluida antes de permitir un cierre posterior.

## API y administración

- `POST /api/pos2/orders/:id/complete`
- `GET /api/pos2/sales`
- `GET /api/pos2/sales/:id`
- `GET /api/pos2/sales/:id/receipt`
- `/administration/pos2/sales`: pagos simples/mixtos, consulta de Sales y configuración explícita de unidades de receta.

Todas las rutas exigen usuario y credencial activa de terminal. El DTO de recibo contiene sucursal, caja, cajero, snapshots de artículos, desglose de pagos y cambio.

## Fuera de alcance

No hay refunds, returns, promociones, offline, impresión, dual-write con POS V1, rollout, commit, push ni deploy.
