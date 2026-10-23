# POS 2.0 — State machines

## Order

Estados mínimos: `OPEN`, `PAYMENT_PENDING`, `FINALIZED`, `VOIDED`, `EXPIRED`.

`DRAFT` y `OPEN` se unifican. Order no necesita `COMPLETED`: la finalización crea Sale y deja Order `FINALIZED`.

| FROM | TO | COMMAND | Preconditions | DB effects | Audit | Capability | Failure |
|---|---|---|---|---|---|---|---|
| — | OPEN | CreateOrder | sesión OPEN, terminal activo | Order vacío version=1 | order.created | `pos.order.create` SELF/branch | sin fila si falla |
| OPEN | OPEN | MutateOrder | expectedVersion coincide; catálogo disponible | líneas/version; opcional quote | order.changed resumido | `pos.order.edit` SELF | VERSION_CONFLICT |
| OPEN | PAYMENT_PENDING | BeginPayment | líneas válidas, quote vigente | congela edición normal | order.payment_pending | `pos.sale.create` | vuelve OPEN si no hubo efecto externo |
| PAYMENT_PENDING | OPEN | AbortPayment | ningún payment irreversible | desbloquea/reprice | order.payment_aborted | `pos.sale.create` | permanece pendiente si pago incierto |
| OPEN/PAYMENT_PENDING | FINALIZED | CompleteSale | invariantes completas | crea Sale y todos los ledgers atómicamente | sale.completed | `pos.sale.create` | rollback completo/replay |
| OPEN | VOIDED | VoidOrder | sin pago capturado ni Sale | reason/voidedAt | order.voided | SELF o `pos.order.void.any` | estado previo intacto |
| OPEN | EXPIRED | ExpireOrder | TTL y sin pago | expiredAt | order.expired | SYSTEM | retry idempotente |

Imposibles: FINALIZED→OPEN/VOIDED/EXPIRED; VOIDED/EXPIRED→OPEN; PAYMENT_PENDING→VOIDED si existe pago incierto/capturado.

## Sale

Estados derivados mínimos: `COMPLETED`, `PARTIALLY_RETURNED`, `RETURNED`, `CANCELLED`. Refund no define por sí solo estado físico de Sale; se consulta por payments/refunds.

| FROM | TO | COMMAND | Preconditions | DB effects | Audit | Capability | Failure |
|---|---|---|---|---|---|---|---|
| — | COMPLETED | CompleteSale | Order finalizable, pagos=total, stock | documento y ledgers | sale.completed | `pos.sale.create` | rollback total |
| COMPLETED | CANCELLED | CancelSale | ventana/política, cero returns previos, monto cancelable completo | Cancel document + financial/inventory/cash reversals | sale.cancelled | `pos.sale.cancel` BRANCH + posible approval | no cambio parcial |
| COMPLETED | PARTIALLY_RETURNED | CreateReturn | quantity 0<q<returnable | Return + movements | return.completed | `pos.return.create` | rollback |
| COMPLETED | RETURNED | CreateReturn | devuelve todo returnable | Return + movements | return.completed | `pos.return.create` | rollback |
| PARTIALLY_RETURNED | PARTIALLY_RETURNED | CreateReturn | aún queda cantidad | Return adicional | return.completed | `pos.return.create` | rollback |
| PARTIALLY_RETURNED | RETURNED | CreateReturn | agota cantidad | Return adicional | return.completed | `pos.return.create` | rollback |

Imposibles: CANCELLED→cualquier estado; RETURNED→nueva devolución/cancelación; PARTIALLY_RETURNED→CANCELLED; cualquier transición que reabra o cambie totales/líneas originales. Si se necesita corregir un Return, se crea reversión del Return bajo comando separado futuro.

## Payment y Refund

Primera generación registra únicamente pagos confirmados en la transacción de `CompleteSale`: `CAPTURED`. Preparación futura: `PENDING|AUTHORIZED|CAPTURED|FAILED|VOIDED|PARTIALLY_REFUNDED|REFUNDED`. CARD/TRANSFER externos se confirman antes de la transacción corta; el resultado confirmado entra como evidencia. Estado incierto nunca permite finalizar.

Refund: `PENDING→COMPLETED|FAILED`; CASH puede completarse atómicamente con CashMovement. Proveedor externo se ejecuta fuera de la tx y se finaliza mediante saga/outbox con estado PENDING; nunca mantener una tx DB durante llamada de red.

## CashSession y CashCut

CashSession: `OPEN→CLOSING→CLOSED`. `CLOSING→OPEN` solo si cierre falla antes de finalizar Cut y no hay sobre. No puede haber ventas cuando no está OPEN. CashCut: `DRAFT→FINALIZED→REVIEWED`; FINALIZED no vuelve a draft.

## Terminal

`PENDING_ENROLLMENT→ACTIVE→SUSPENDED|REVOKED`; SUSPENDED puede volver ACTIVE con permiso global, REVOKED es terminal.
