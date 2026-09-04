# POS 2.0 — Diseño transaccional y arquitectura de caja

## CompleteSale: una transacción PostgreSQL

Preparación fuera de tx: validar forma del input, autenticar terminal/usuario, construir JSON canónico/hash, obtener confirmación de CARD/TRANSFER si aplica y preparar IDs. No llamar proveedores, correo, impresión, Blob ni analytics dentro de tx.

Secuencia exacta dentro de tx corta:

1. reclamar/leer `OperationReceipt`; replay si COMPLETED, rechazar hash distinto;
2. cargar Order `FOR UPDATE`; validar expectedVersion y estado OPEN/PAYMENT_PENDING;
3. validar capability y que Branch/Register/Terminal/CashSession coinciden y session está OPEN;
4. recalcular/verificar quote desde versiones publicadas; si cambió, abortar PRICE_CHANGED;
5. validar tenders confirmados y suma Decimal exacta;
6. obtener necesidades de inventario desde RecipeVersion snapshot, agrupar y ordenar claves;
7. bloquear `InventoryBalance` en orden estable; validar stock suficiente;
8. asignar business number mediante secuencia/serie transaccional;
9. crear Sale y SaleLines con snapshots;
10. crear Payments CAPTURED;
11. crear FinancialEntries y CashMovements aplicables;
12. crear InventoryMovements y actualizar InventoryBalance;
13. marcar Order FINALIZED/version+1;
14. crear AuditEvents y OutboxEvents;
15. completar OperationReceipt con resultado mínimo;
16. commit.

Cualquier error revierte todo. Deadlock/40001 se reintenta con la misma operation key, máximo acotado. Unique violation de operation/order se resuelve como replay, no como segunda venta.

Después del commit: responder ticket; workers procesan impresión remota, notificaciones, reporting y telemetría desde outbox. Si la respuesta se pierde, el cliente consulta/reintenta la misma key.

## Cancel, Return, Refund

- Cancel: lock Sale y cantidades/refundable, validar estado/ventana, crear documento de cancelación, reversals financieros/inventario/caja, estado derivado y audit en una tx.
- Return: lock filas de acumulado returnable por SaleLine en orden; validar; crear Return/Lines y InventoryMovements según disposición en una tx.
- CASH refund: lock Payment/refundable y CashSession, crear Refund+Financial/CashMovement en una tx.
- CARD/TRANSFER refund: crear intención PENDING en tx, emitir outbox, llamar proveedor fuera, finalizar COMPLETED/FAILED en nueva tx idempotente. Estado incierto se reconcilia por external reference antes de retry.

## Arquitectura de caja

```text
Branch
  └─ Register (unidad financiera)
       ├─ Terminal(s) autorizadas (dispositivos)
       └─ CashSession OPEN
            ├─ opening CashDeclaration
            ├─ Sales → Payments
            │            └─ CASH → CashMovement(CASH_SALE)
            ├─ inflows/outflows/refunds → CashMovements
            ├─ closing CashDeclaration
            └─ CashCut (reconciliación final)
                   └─ CashSafeEnvelope PENDING
                        └─ recepción/retiros/ajustes → ledger actual → Safe
```

Flujo: `OPEN → SALES → CASH MOVEMENTS → CLOSE → RECONCILIATION → ENVELOPE → SAFE`.

Fuentes de verdad:

- autorización del dispositivo: Terminal;
- ubicación/unidad financiera: Register;
- periodo operativo: CashSession;
- ventas/pagos: Sale/Payment;
- efectivo esperado: suma CashMovement;
- efectivo contado: CashDeclaration y denominaciones;
- diferencia/cierre: CashCut finalizado;
- dinero enviado/recibido/retiros de safe: CashSafeEnvelope y su movement ledger actual.

El CashCut legacy se mantiene durante coexistencia. Un adapter mapea cada corte legacy a sesión/cut V2 o crea `LEGACY_IMPORTED`; nunca se hace que el nuevo Cut reescriba el viejo.

## Locks y aislamiento

- Default Read Committed con row locks explícitos ordenados.
- Serializable solo para dominios ya probados donde la invariante cruza un conjunto difícil de bloquear, como el ledger actual de sobres.
- Unique constraints para un session abierto, operation receipt, Sale por Order y components.
- No sostener locks mientras se solicita PIN, se llama proveedor, se sube evidencia o se espera al usuario.
