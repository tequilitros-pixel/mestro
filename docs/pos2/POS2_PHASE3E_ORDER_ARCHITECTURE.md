# POS 2.0 — Arquitectura Orders V2 (Fase 3E)

## Frontera del agregado

`Pos2Order` representa un carrito pre-venta mutable. No es `PosSale`, no crea Payment, no escribe `CashMovement` y no consume ni reserva inventario. La futura operación `CompleteSale` será responsable de volver a validar precio/stock y crear el snapshot financiero definitivo de Sale en una transacción propia.

POS V1 no lee ni dual-write Orders V2. La única superficie activa es API POS2 y `/administration/pos2/orders`.

## State machine

```text
OPEN ──BeginPayment──> PAYMENT_PENDING ──CompleteSale futuro──> FINALIZED
  │                          │
  ├──Void──> VOIDED          ├──ResumeOrder──> OPEN
  └──Expire──> EXPIRED       └──Void──> VOIDED
```

`FINALIZED`, `VOIDED` y `EXPIRED` son terminales. Fase 3E no expone una ruta pública hacia `FINALIZED`; sólo existe `finalizeOrderFromCompleteSale` como frontera interna reservada. Todas las mutaciones toman `FOR UPDATE`, validan `expectedVersion` e incrementan `version`. No existe PATCH genérico de status.

## Modelos y snapshots

`Pos2Order` guarda contexto Branch/Register/Terminal/CashSession/actor, moneda, totals Decimal, `pricingTimestamp`, versión y timestamps terminales. `orderNumber` combina branch code, día UTC y una secuencia PostgreSQL concurrency-safe; el UUID sigue siendo PK.

`Pos2OrderLine` identifica exactamente PRODUCT o VARIANT, nunca ambos. Conserva:

- target y nombre de presentación;
- `catalogVersion` preliminar;
- Quantity/unidad;
- `unitPrice`, subtotal, descuento reservado en cero y total;
- FK a la `PriceVersion` usada;
- explanation global o branch.

Esto permite renderizar y detectar cambios, pero no sustituye el futuro snapshot inmutable de Sale. Los importes son tax-inclusive bajo la convención aprobada de Pricing V2.

## Mutación, cantidad y totals

UNIT exige cantidades enteras positivas; ML admite Decimal positivo. No hay coerción entre unidades. Cada edición OPEN vuelve a resolver Pricing V2. `discountTotal` permanece exactamente en cero hasta una fase de descuentos/promociones.

La política de duplicados combina únicamente cuando target y `priceVersionId` coinciden. Esto optimiza el POS rápido y deja abierta la posibilidad de líneas separadas cuando futuros modifiers formen parte de la identidad.

El servidor calcula `lineTotal = Money(unitPrice) × Quantity` y `Order.total = Σ lineTotal`. Checks PostgreSQL refuerzan cantidades, totals, target, moneda y metadata terminal.

## Reprice y PAYMENT_PENDING

`RepriceOrder` carga catálogo y precios en batch. Cada línea queda clasificada como `UNCHANGED`, `PRICE_CHANGED`, `PRICE_NOT_CONFIGURED` o `PRODUCT_UNAVAILABLE`.

- OPEN: aplica explícitamente el precio vigente y actualiza snapshot/totals.
- PAYMENT_PENDING: nunca modifica silenciosamente; un cambio produce `PRICE_CHANGED` con IDs seguros para regresar al carrito.

`BeginPayment` exige líneas, CashSession OPEN y reprice preliminar, luego congela la Order. `ResumeOrder` es la única vuelta explícita a OPEN. CompleteSale deberá repetir validación.

## Concurrencia, idempotencia y auditoría

Create, Add, Update, Remove, Reprice, BeginPayment, Resume, Void y Expire se ejecutan en transacciones. Create/Add/Begin/Void —y adicionalmente todas las mutaciones expuestas— usan `OperationReceipt`. La misma operationId/payload reproduce el resultado; otro payload falla.

El lock de Order más `expectedVersion` garantiza un ganador en add/update/begin/void concurrentes. Eventos: `ORDER_CREATED`, `ORDER_LINE_ADDED`, `ORDER_LINE_UPDATED`, `ORDER_LINE_REMOVED`, `ORDER_REPRICED`, `ORDER_PAYMENT_STARTED`, `ORDER_PAYMENT_ABORTED`, `ORDER_VOIDED` y `ORDER_EXPIRED`.

## Caja, terminal y recuperación

Una Order pertenece a la CashSession donde nació. CashSession debe seguir OPEN al crear y al comenzar pago. `closeCashSession` rechaza si existe una Order `PAYMENT_PENDING`, antes de crear declaración/corte.

Las Orders OPEN no bloquean el cierre: quedan como historial recuperable, pero ya no pueden entrar a PAYMENT_PENDING porque su CashSession está cerrada; deben anularse/expirarse o recrearse en la sesión vigente mediante un flujo explícito. No existe migración silenciosa entre sesiones.

Terminal fue definida en Fase 3B como independiente de Register. Por ello la recuperación se permite a otra terminal activa de la misma Branch —no se puede inferir afiliación permanente a Register— siempre que el actor tenga capability; el Register original permanece en la Order y la acción queda auditada. Las APIs verifican credencial terminal y coincidencia de Branch.

`GetOpenOrders` recupera OPEN/PAYMENT_PENDING por branch, register, actor, status y rango de fecha. No existe entidad “parked order”. Expiración usa `expiresAt` y un command explícito; no hay worker todavía y nunca se eliminan registros.

## Capabilities y límites

Capabilities autoritativas: `pos.order.create`, `pos.order.edit`, `pos.order.void`, `pos.order.recover`, `pos.payment.begin`. Se aplican con scope Branch/Multi/Global y aislamiento de actor/terminal.

No hay promociones, Payment, Sale V2, refunds, returns, reservas, Inventory Ledger, CompleteSale público, offline ni UI POS final.
