# MAESTRO POS 2.0 — Propuesta de modelo de datos

Propuesta conceptual; **no se modificó Prisma**.

## Organización y dispositivos

- `Branch`: conservar.
- `Register`: id, branchId, code, name, active, configurationVersionId.
- `Terminal`: id, registerId, deviceKeyHash, label, status, lastSeenAt, appVersion.
- `CashSession`: id, registerId, terminalId, openedBy, openedAt, closedAt, status.
- `UserBranchRole` o asignaciones de capabilities scoped; migrar gradualmente desde `UserBranch`/`ModulePermission`.

## Catálogo, recetas y precios

- `CatalogProduct` y `CatalogVariant`: identidad estable, SKU/barcode, lifecycle.
- `CatalogPublication`: branch/canal, versión publicada.
- `RecipeVersion` + `RecipeIngredient`: versión inmutable y unidad base.
- `PriceList`: scope global/branch/canal, moneda, prioridad.
- `PriceEntry`: variantId, amount Decimal(19,4), validFrom/validTo, version, status.
- `Promotion` + `PromotionVersion` + condiciones/beneficios tipados.
- `PricingSnapshot`: entrada/evaluación serializada de forma estructurada y hash/version.
- `AdjustmentApplication`: tipo, ruleVersionId, base, amount, reasonId, authorizedBy.

## Venta y pagos

- `Order`: carrito durable con `version` para optimistic concurrency y estados DRAFT/PRICED/PAYMENT_PENDING/FINALIZED/ABANDONED.
- `OrderLine`: variant y recipe/price snapshot.
- `Sale`: documento final inmutable, business number, orderId único, branch/register/terminal/session, currency, totals Decimal, status.
- `SaleLine`: snapshot completo; sin cascade destructivo desde Sale.
- `Payment`: tender y monto objetivo; estados PENDING/AUTHORIZED/CAPTURED/FAILED/VOIDED/PARTIALLY_REFUNDED/REFUNDED.
- `PaymentAttempt`: provider, external reference única, request/response status sanitizado.
- `Return`/`ReturnLine`: productos, motivo, disposición de inventario y saleLine original.
- `Refund`: payment original, amount, method, external reference y estado.
- `OperationReceipt`: operationId único, command type, aggregate/result IDs, payloadHash, completedAt.

## Ledgers y auditoría

- `FinancialEntry`: append-only, Decimal, account/type/source/reversalOf, cashSessionId.
- `InventoryMovement`: append-only, Decimal, unit, source/reversalOf, operationId unique por componente.
- `InventoryBalance`: proyección optimizada con version; nunca fuente histórica.
- `CashDeclaration`: apertura/cierre/reconteo, denominaciones y actor.
- `CashMovement`: tender, amount, reason, source y reversal.
- `SafeEnvelope`/`SafeEnvelopeMovement`: evolucionar los modelos actuales, conservando constraints y locks.
- `AuditEvent`: actor, impersonator opcional, branch/register/terminal, action, resource, before/after permitido, reason, operationId, occurredAt.
- `OutboxEvent`: evento transaccional para proyecciones/integraciones.

## Configuración

- `ConfigurationDefinition`: key, tipo, schema, nivel permitido y si requiere aprobación.
- `ConfigurationVersion`: key, scopeType/scopeId, value JSON validado, validFrom, status, created/approvedBy.
- Catálogos administrables separados para `PaymentMethodDefinition`, `ReasonDefinition` y políticas POS.

No deben ser configurables: ecuaciones contables, constraints de idempotencia, autorización base, reglas de doble partida/reversal, aislamiento de tenant/branch, algoritmos de locking y validaciones que impidan corrupción.

## Constraints esenciales

- Unique `(organizationId, operationId)` para todo comando.
- Unique business number por branch/register/serie.
- Unique orderId en Sale; payment external reference donde aplique.
- Check amounts no negativos en documentos y cantidad firmada en ledgers.
- Foreign keys restrict para historia financiera; sin cascade delete de Sale/Payment/Ledgers/Audit.
- Índices `(branchId, occurredAt)`, `(cashSessionId, occurredAt)`, `(productId, branchId, occurredAt)`, `(status, createdAt)` y los dictados por explain plans.
- Version/CAS en Order, InventoryBalance y Configuration drafts.
- Retención/inmutabilidad reforzada por permisos DB para ledgers.
