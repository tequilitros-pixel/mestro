# MAESTRO POS 2.0 — Arquitectura propuesta

## Principios

1. Modular monolith primero: dominios claros dentro de la misma app/DB, sin microservicios prematuros.
2. Todo comando financiero lleva `operationId`, actor, branch, register, terminal y timestamp.
3. Hechos históricos se agregan; no se borran ni reescriben silenciosamente.
4. Dinero en `Decimal`/minor units y moneda explícita; cantidades en Decimal y unidad base.
5. Configuración operativa como datos versionados; invariantes de integridad permanecen en código/DB.
6. Server-side authorization por capacidad y scope en cada command/query.
7. Transacción de escritura + audit/outbox en el mismo commit.

## Dominios y dependencias

`CATALOG` define productos/variantes/recetas. `PRICING` publica listas y vigencias. `PROMOTIONS` evalúa reglas sobre un carrito y devuelve aplicaciones explicables. `SALES` congela el resultado en Order/Sale. `PAYMENTS` registra intentos, pagos y reembolsos. `INVENTORY` consume recetas mediante movimientos. `CASH MANAGEMENT` proyecta pagos y movimientos sobre una sesión de caja. `BRANCHES/REGISTERS/TERMINALS` definen el scope operativo. `AUTHORIZATION` decide capacidades. `AUDIT` registra hechos. `REPORTING` consume proyecciones. `CONFIGURATION` versiona decisiones operativas.

Una finalización de venta debe ejecutar, en una transacción DB cuando el pago ya esté confirmado:

1. reclamar `operationId` único;
2. bloquear/verificar Order y stock según política;
3. congelar precios, promociones, impuestos y líneas;
4. crear Sale, Payments aceptados y entradas del financial ledger;
5. crear movimientos de inventario referenciados;
6. crear proyección de caja aplicable;
7. agregar AuditEvent y OutboxEvent;
8. confirmar y responder siempre el mismo resultado para el mismo operation ID.

## Motor de precios

Orden recomendado de evaluación:

1. resolver precio base desde price book aplicable a branch/canal y vigencia;
2. elegir la entrada de mayor especificidad y prioridad determinista;
3. evaluar promociones elegibles por fecha, día/hora, producto/categoría, cantidad, combo, empleado y branch;
4. aplicar exclusiones/stacking groups y límites;
5. aplicar descuentos manuales/cortesías con autorización;
6. redondear una sola vez con regla definida;
7. guardar `PricingSnapshot` y cada `AdjustmentApplication`.

Un precio publicado se vuelve inmutable. Cambiarlo crea una nueva versión con `validFrom/validTo`; ventas conservan precio de lista, precio efectivo, regla/version aplicada y valor del beneficio.

## Ledger financiero

Crear `FinancialEntry` append-only con monto firmado, moneda, cuenta lógica, tipo, branch, cashSession, sale/payment/refund origen y reversalOf. Cada evento balancea débitos/créditos conceptuales o, como mínimo, conserva una ecuación reconciliable.

- Venta: reconoce ingreso/por cobrar según método.
- Pago: mueve desde tender clearing a ingreso/caja.
- Refund: movimiento negativo enlazado al pago original.
- Void/cancel: reversal enlazado, nunca delete.
- Entrada/salida de caja: movimiento con motivo/actor.
- Cierre: declaración y snapshot, no mutación de ventas.
- Sobre: conservar el ledger actual e integrarlo como transferencia `cash_on_hand → envelope_pending → safe_cash → withdrawal`.

`CashSalePayment` pasa a ser una proyección reconstruible. El ledger de sobres actual es el patrón a reutilizar.

## Ledger de inventario

`InventoryMovement` append-only: `PURCHASE`, `SALE`, `SALE_REVERSAL`, `TRANSFER_IN`, `TRANSFER_OUT`, `WASTE`, `ADJUSTMENT`, `COUNT_CORRECTION`, `PRODUCTION`, `RETURN`. Campos mínimos: product/variant, branch, quantity Decimal firmada, unit, actor, terminal, operationId, occurredAt, sourceType/sourceId, reversalOf, cost snapshot y metadata controlada.

Saldo es una proyección por branch/product. Conteo físico no sustituye el historial: genera `COUNT_CORRECTION` por diferencia. Transferencias comparten `transferId`. La venta usa la versión de receta congelada. Para convivir con `InventoryEntry`, escribir primero mediante un adapter que produzca el formato legado y nuevo, reconciliar, luego cambiar lecturas y finalmente retirar el legado.

## Autorización

Capacidades sugeridas: `pos.sell`, `pos.override_price`, `pos.discount.apply`, `pos.courtesy.apply`, `sale.void`, `return.create`, `refund.issue`, `inventory.adjust`, `cash.open`, `cash.close`, `cash.withdraw`, `safe.receive`, `catalog.manage`, `pricing.publish`, `reports.financial.view`, `users.manage`, `configuration.manage`.

Una policy recibe actor, capability, branch/resource y contexto (monto, porcentaje, corte cerrado). La UI consume permisos para experiencia, pero el command handler siempre decide de nuevo. Defaults deben ser deny, no fail-open.

## Offline futuro

- `operationId` UUID/ULID generado antes del primer submit, online u offline.
- Envelope local firmado lógicamente con tenant/branch/register/terminal/user/schemaVersion/createdAt/payload.
- Estados locales: draft, queued, sending, accepted, rejected, needs_review.
- FIFO por dependencias, pero colas separables por aggregate para no bloquear toda operación por un error independiente.
- El servidor conserva `OperationReceipt` unique y devuelve el mismo resultado.
- Conflictos: precio/config version mismatch, caja cerrada, sesión expirada, stock insuficiente. Nunca “last write wins” para dinero.
- El ticket offline debe marcarse pendiente hasta aceptación; reglas para numeración provisional y fiscal requieren aprobación.

## Performance y observabilidad

- Batch writes para items/movements; índices compuestos definidos por consultas reales.
- Catálogo incremental por versión/ETag y búsqueda local indexada.
- Métricas P50/P95/P99 de catálogo, price quote, finalize sale y sync.
- Logs estructurados sin secretos con operationId/saleId/branch/register/terminal.
- Panel de operaciones rechazadas, pagos huérfanos, diferencias de ledger, stock negativo y cola offline envejecida.
- Reconciliación automática diaria: suma de pagos = venta/refunds; efectivo de sesión = movimientos/declaración; inventario projection = ledger.
