# POS 2.0 — Plan de migraciones de base de datos

No ejecutar en esta fase. Todas son aditivas hasta el retiro final.

| Orden | Propósito / tablas | Constraints e índices | Backfill | Riesgo | Rollback lógico / compatibilidad |
|---:|---|---|---|---|---|
| 01 | `OperationReceipt`, `AuditEvent`, `OutboxEvent` | operation unique, aggregate/branch/date | ninguno | Bajo | dejar tablas sin consumidores; V1 intacto |
| 02 | capability grants/templates/approvals | user/capability/scope uniques | mapear roles/UserBranch/ModulePermission | Medio por permisos | shadow-only; legacy sigue autoritativo |
| 03 | `Register`, `Terminal` | branch+code; device unique | un register default por branch; terminales se enrolan, no inferir dispositivos | Medio | flags no los exigen; V1 usa branch |
| 04 | `CashSession`, `CashDeclaration`, `CashCutV2` | unique parcial open por register; cut unique session | cortes activos se dejan legacy o sesión puente explícita | Alto | no activar commands V2 |
| 05 | catálogo identities/versiones/BranchOverride | SKU/barcode uniques, scope indexes | mapa explícito PosProduct/Variant; conservar IDs mapping | Medio | lectura V1 intacta |
| 06 | Price/PriceRule/Promotion versions | validity indexes/constraints | convertir Float desde texto a Decimal y reporte de diferencias | Alto financiero | shadow prices; V1 sigue cobrando |
| 07 | Order/OrderLine | terminal/status/version | ninguno | Bajo | feature flag off |
| 08 | Sale/SaleLine/Payment/Refund/Return | order unique, restrict FKs, Decimal checks | no importar aún o importar en job separado | Alto | V2 off; tablas aditivas |
| 09 | `InventoryMovement`, `InventoryBalance` | branch+item unique; ledger component unique; composite indexes | baseline firmado desde conteo+entries a cutoff | **Alto** | shadow ledger; InventoryEntry autoritativo |
| 10 | `FinancialEntry`, `CashMovement` | operation/source uniques, session indexes | balances iniciales por cutoff documentado | Alto | shadow-only |
| 11 | referencias opcionales desde `CashSafeEnvelope` a sesión/cut/movement V2 | índices, sin retirar cashCutId legacy | enlazar solo matches inequívocos | Medio | ignorar columnas nuevas |
| 12 | dual-write adapters/outbox markers | uniques para correlación legacy/V2 | mapping tables | Alto | detener dual write, conservar data |
| 13 | shadow read/projection indexes | índices concurrentes donde proceda | build/reconcile projections | Performance | drop index si validado seguro |
| 14 | import histórico opcional | flags `LEGACY_IMPORTED`, source legacy ID unique | jobs resumibles por rango | Alto volumen | borrar solo import no publicado mediante runbook; nunca datos legacy |
| 15 | cutover constraints/not-null graduales | validate constraints separadamente | completar nulos | Alto deploy | flags vuelven a V1; no drop |
| 16 | legacy read-only | permisos/triggers prevent write tras cutover | ninguno | Alto operativo | reautorizar temporalmente con runbook |
| 17 | retiro futuro | drops/cambios legacy | N/A | Máximo | fuera de POS 2.0 inicial; backup y aprobación separada |

## Reglas de ejecución futura

- Cada migración se prueba con copia sanitizada y tiempos medidos.
- Crear índices grandes de forma compatible con PostgreSQL/Prisma, evitando locks prolongados.
- Backfills son jobs reanudables con checkpoint, batch y métricas; no dentro de migration transaction larga.
- Constraints nuevas se añaden `NOT VALID`/validación posterior cuando aplique.
- Antes del baseline de inventario/caja: cutoff, checksum, responsable y acta de reconciliación.
- Ninguna conversión Float→Decimal sobrescribe Float; se escribe columna/tabla nueva y se compara.

## Convivencia adaptada al repositorio real

- `PosSale`/`PosSaleItem`/`PosSalePayment` continúan V1; V2 usa tablas nuevas para no alterar RLS/páginas actuales.
- `InventoryEntry` sigue alimentando `computeStockMatrix`; adapter/shadow ledger compara hasta migrar lecturas.
- `CashSalePayment` sigue siendo proyección del corte V1; V2 deriva de Payment/CashMovement.
- `CashSafeEnvelope` y `CashSafeEnvelopeMovement` se reutilizan, no se duplican.
- La cola IndexedDB existente debe evolucionar a los command envelopes, manteniendo compatibilidad por schemaVersion.
