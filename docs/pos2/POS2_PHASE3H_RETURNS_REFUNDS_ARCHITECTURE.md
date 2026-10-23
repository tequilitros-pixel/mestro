# POS 2.0 — Fase 3H: Cancel, Return y Refund

## Semántica

- **Cancel** corrige excepcionalmente una Sale `COMPLETED` completa. Crea `SaleCancellation`, una `PaymentReversal` por pago, movimientos históricos `SALE_REVERSAL`, compensación cash y proyecta Sale a `CANCELLED`. Se excluye si ya existe Return o Refund.
- **Return** documenta devolución física/operacional parcial o total mediante `Pos2Return` y `ReturnLine`. No devuelve dinero. `RESTOCK` repone proporcionalmente el consumo histórico; `DAMAGED` y `DISCARD` no incrementan stock disponible.
- **Refund** devuelve dinero mediante `Pos2Refund` y allocations explícitas contra Payments capturados. No implica Return y no cambia el status de Sale.

## Historia e inmutabilidad

Nunca se recalcula receta ni pricing. Cancel usa exactamente los `InventoryMovement SALE_CONSUMPTION` originales. Return usa esos movimientos y la proporción `returned quantity / sold quantity`. Refund usa importes de Payments históricos. Los documentos, líneas, allocations y reversas rechazan UPDATE/DELETE en PostgreSQL.

Sale mantiene snapshots inmutables; únicamente `status` funciona como proyección controlada por trigger. Las transiciones aceptadas requieren que el documento compensatorio ya exista en la misma transacción.

## Caja cerrada, CashCut y envelopes

Una compensación cash usa una CashSession `OPEN` de la misma sucursal. Si la sesión original continúa abierta, debe usarse esa misma. Si está cerrada, se usa la sesión operativa actual. La sesión original, CashCut y CashSafeEnvelope no se actualizan. El movimiento nuevo referencia Sale/documento y `originalCashSessionId`.

Tarjeta y transferencia son registros operacionales; la fase no integra adquirente/banco. Sus RefundAllocation requieren referencia externa.

## Locks e invariantes

Orden común: Sale `FOR UPDATE` → CashSession de compensación → InventoryBalance ordenado. Serializar sobre Sale garantiza:

- máximo una cancelación;
- suma ReturnLine por SaleLine ≤ cantidad vendida;
- suma RefundAllocation por Payment ≤ capturado;
- total refunds ≤ total pagado;
- Cancel compite excluyentemente contra Return/Refund;
- Return y Refund pueden coexistir.

Todos los comandos usan OperationReceipt. Mismo operationId/payload reproduce; payload distinto produce `IDEMPOTENCY_KEY_REUSED`.

## Autorización y eventos

Capabilities: `pos.sale.cancel`, `pos.return.create`, `pos.return.restock`, `pos.refund.create` y una capability por método cash/card/transfer. Se emiten eventos de auditoría y outbox en la misma transacción.

## API

- `POST /api/pos2/sales/:id/cancel`
- `POST /api/pos2/sales/:id/returns`
- `POST /api/pos2/sales/:id/refunds`
- `GET /api/pos2/sales/:id`
- `GET /api/pos2/sales/:id/compensations/:kind/:documentId/receipt`

`GetSale` agrega historia compensatoria, cantidades retornables, importe reembolsable y referencias cash/inventory. `/administration/pos2/sales` es únicamente un harness administrativo.

## Extensión futura

Los documentos conservan `actorId`; un workflow posterior puede añadir `requestedById`, `approvedById` y reglas por monto sin alterar hechos existentes. No se implementó aprobación compleja, promociones, offline, impresión, POS final ni rollout.
