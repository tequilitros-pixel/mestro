# MAESTRO POS 2.0 — Estrategia de migración

## Enfoque

Transición incremental, sin Big Bang. La ruta actual continúa operando hasta que cada invariantes, reconciliación y rollback estén probados.

1. **Contención previa**: corregir autorización P0, doble cancelación, operation ID obligatorio y dinero Decimal sin cambiar UX. Añadir pruebas de caracterización.
2. **Fundaciones aditivas**: tablas nuevas para Register/Terminal/OperationReceipt/Audit/ledgers/config versions; ningún retiro del esquema actual.
3. **POS 2 detrás de flag**: nueva ruta `/pos/v2`, habilitada por usuario/terminal/branch. Mismo catálogo leído mediante adapters.
4. **Dual-write controlado**: command service escribe fuente legacy y ledger nuevo en la misma transacción/outbox. Si no puede ser atómico, detener y diseñar reconciliación explícita; no dual-write informal.
5. **Shadow reads**: calcular totales, stock y caja desde ambos modelos; registrar diferencias sin afectar al cajero.
6. **Piloto**: una sucursal, una caja, turno acotado, personal entrenado y soporte en sitio. Criterios de salida cuantitativos.
7. **Cutover por capacidad**: primero catálogo/precios, luego ventas/pagos, después inventario/caja/reportes. Activación por branch/register.
8. **Retiro gradual**: congelar escritura legacy, conservar lectura histórica, archivar adapters solo tras varios cierres reconciliados.

## Compatibilidad y reconciliación

- Mapear IDs legacy a IDs nuevos; nunca inferir por nombre.
- Importar historial como snapshots, distinguiendo `LEGACY_IMPORTED`.
- `InventoryEntry` y ledger nuevo se comparan por source operation; conteos iniciales fijan una fecha de apertura controlada.
- `CashSalePayment` se compara contra Payment/FinancialEntry por corte y método.
- `CashSafeMovement` legado conserva saldo inicial; `CashSafeEnvelope` actual migra uno a uno.
- Reporte diario de diferencias con dueño y resolución documentada.

## Feature flags y rollback

- Flags server-side versionadas: `pos2.catalog`, `pos2.checkout`, `pos2.inventory`, `pos2.cash` por branch/register.
- Kill switch inmediato bloquea nuevas operaciones V2, conserva consulta/cola y redirige a V1 solo si hacerlo no duplica operaciones pendientes.
- Rollback de código no borra datos V2. OperationReceipt impide repetir ventas al volver.
- Antes de cada rollout: backup verificado, runbook, responsables, ventana, métricas y criterio de aborto.

## Gates de avance

- 100% de pruebas P0/P1 verdes.
- Cero diferencias no explicadas en ventas/pagos/caja/inventario durante el periodo piloto acordado.
- P95 de cobro dentro del SLO acordado.
- Cero acceso cross-branch en suite de seguridad.
- Cola offline recuperable y observable; ninguna operación perdida.
- Aprobación explícita de Operaciones, Finanzas y responsable técnico.

No comenzar esta estrategia sin aprobar primero las ocho decisiones listadas en `POS_GAP_ANALYSIS.md`.
