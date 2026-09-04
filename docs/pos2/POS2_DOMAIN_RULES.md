# POS 2.0 — Reglas de dominio y modelo conceptual definitivo

Estado: especificación aprobable, sin implementación. Fecha: 2026-08-30.

## Decisiones base

- Catálogo empresarial global con overrides por sucursal; nunca clonar el catálogo completo.
- Stock suficiente obligatorio al finalizar; stock negativo solo será una política futura explícita y autorizada.
- Dinero nuevo en `Decimal(19,4)` internamente y `Decimal(19,2)` donde el documento legal/operativo sea MXN a centavos. No usar `Float` ni convertir a `number` durante cálculos.
- Cantidad en unidad base determinística mediante `Decimal(19,6)`: piezas=`UNIT`, líquidos=`ML`; toda conversión se centraliza y deja snapshot.
- Sale es inmutable como documento económico. Correcciones producen documentos y movimientos compensatorios.
- `operationId` es obligatorio en todo comando sensible.
- Register, Terminal, CashSession y CashCut son conceptos separados.
- El ledger actual de `CashSafeEnvelope` se conserva e integra.

## Entidades definitivas

Cada tabla nueva deberá incluir `createdAt`; las mutables también `updatedAt`. IDs: UUID v7 generado por servidor o cliente confiable según contrato. La representación Prisma podrá usar `String @db.Uuid`.

### CatalogProduct

- **Purpose:** identidad comercial empresarial estable.
- **PK:** `id`.
- **Important fields:** `name`, `description`, `status`, `categoryId`, `defaultTaxCode`, `defaultVisibility`, `revision`.
- **FK:** Category.
- **Uniques:** SKU no vive aquí si varía por presentación; opcional externalCode único global.
- **Indexes:** `(status, categoryId)`, normalized name/search.
- **Mutability:** metadatos editables; identidad no reciclable.
- **Retention:** permanente/soft archive.
- **Audit:** create/update/archive y before/after de campos operativos.

### CatalogVariant

- **Purpose:** presentación vendible estable.
- **PK:** `id`.
- **Important fields:** `productId`, `sku`, `barcode`, `name`, `baseUnit`, `status`, `recipeVersionId`, `revision`.
- **FK:** Product; receta publicada opcional.
- **Uniques:** `sku` global; barcode único cuando no nulo.
- **Indexes:** product/status, barcode, sku.
- **Mutability:** metadatos; SKU no se reutiliza. Cambios de receta crean versión.
- **Retention:** permanente/archivable.
- **Audit:** toda publicación y cambio.

### BranchProductOverride

- **Purpose:** disponibilidad, visibilidad y orden por sucursal sin duplicar catálogo.
- **PK:** `id`.
- **Important fields:** `branchId`, `variantId`, `available`, `visible`, `displayOrder`, `stockPolicy`, `validFrom`, `validTo`.
- **FK:** Branch, Variant.
- **Uniques:** una versión vigente no solapada por branch+variant; inicialmente unique `(branchId, variantId)` si no hay scheduling.
- **Indexes:** `(branchId, visible, available)`, variant.
- **Mutability:** versionada/publicada; no sobrescribir una versión usada en ventas.
- **Retention/Audit:** permanente; cambios auditados.

### Price

- **Purpose:** importe publicado de una variante en un scope y periodo.
- **PK:** `id`.
- **Fields:** `variantId`, scope `GLOBAL|BRANCH`, `branchId?`, `currency=MXN`, `amount Decimal(19,4)`, `validFrom`, `validTo?`, `priority`, `status`, `version`.
- **FK:** Variant, Branch opcional.
- **Uniques:** evitar periodos activos solapados para misma variante/scope/prioridad mediante servicio y constraint posible.
- **Indexes:** `(variantId, branchId, status, validFrom, validTo)`.
- **Mutability:** draft mutable; published inmutable; corrección crea versión.
- **Retention/Audit:** permanente; publicación requiere actor.

### PriceRule

- **Purpose:** política simple de precio contextual no promocional, por ejemplo empleado.
- **Fields:** `kind`, scope, priority, conditions tipadas, effect tipado, validity, status/version.
- **Uso:** solo incluir reglas reales de primera generación; no construir DSL arbitrario.
- **Mutability/retention:** igual a Price; versiones publicadas inmutables.

### Promotion

- **Purpose:** identidad administrable y ciclo de vida de una promoción.
- **Fields:** name, status, stackingGroup, priority, branch scope, start/end y version actual.
- **PromotionVersion:** condiciones/beneficios tipados para porcentaje/monto y futuro combo; publicada e inmutable.
- **Indexes:** active window y branches.
- **Audit:** draft, approval, publication, suspension.

### Order

- **Purpose:** carrito durable sin efecto financiero ni inventario definitivo.
- **PK:** id.
- **Fields:** `branchId`, `registerId`, `terminalId`, `cashSessionId`, `createdById`, `status`, `version`, `currency`, `pricingVersion`, totals cotizados, `expiresAt?`.
- **FK:** organización operativa y usuario.
- **Uniques:** ninguno además de id; una terminal puede tener varios drafts si la UX lo permite.
- **Indexes:** `(terminalId,status,updatedAt)`, `(cashSessionId,status)`.
- **Mutability:** mutable con optimistic concurrency mientras OPEN; congelada al iniciar pago/finalizar/void.
- **Retention:** drafts abandonados según política; orders finalizadas permanentes.
- **Audit:** transiciones, overrides y void; no cada tecla salvo necesidad.

### OrderLine

- **Purpose:** intención del carrito y último quote.
- **Fields:** orderId, variantId, quantity base/display, notes, quote snapshot parcial, version.
- **Unique:** `(orderId,lineNumber)`.
- **Mutability:** con Order OPEN; no después.

### Sale

- **Purpose:** documento económico oficial finalizado.
- **PK:** id.
- **Fields:** `businessNumber`, orderId, branch/register/terminal/cashSession, seller, currency, subtotal/tax/discount/total Decimal, status `COMPLETED|PARTIALLY_RETURNED|RETURNED|CANCELLED`, completedAt, pricingSnapshotHash.
- **FK:** Order y contexto operativo.
- **Uniques:** orderId; businessNumber dentro de serie/register; complete operation receipt enlazado.
- **Indexes:** branch+completedAt, cashSession+completedAt, status+completedAt, seller.
- **Mutability:** solo estado derivado/transición controlada y metadatos no económicos; totales/líneas inmutables.
- **Retention:** permanente; FK `RESTRICT`, sin cascade delete.
- **Audit:** creación y documentos compensatorios.

### SaleLine

- **Purpose:** snapshot histórico completo.
- **Fields:** definidos en “Snapshots”; incluye original variantId solo como referencia no autoritativa.
- **Unique:** `(saleId,lineNumber)`.
- **Mutability/retention:** inmutable/permanente.

### Payment

- **Purpose:** pago explícito aplicado a Sale.
- **Fields:** saleId, method `CASH|CARD|TRANSFER`, amount Decimal, currency, status `CAPTURED|VOIDED|PARTIALLY_REFUNDED|REFUNDED`, externalReference?, cashSessionId, capturedAt.
- **Uniques:** provider/externalReference cuando aplique; `(saleId, sequence)`.
- **Indexes:** sale, cashSession+method+capturedAt, externalReference.
- **Mutability:** state machine; importe capturado inmutable.
- **Retention/Audit:** permanente; toda transición.

### Refund

- **Purpose:** devolución monetaria vinculada a uno o varios payments originales.
- **Fields:** saleId, paymentId, returnId?, amount, reasonId, status, externalReference, issuedBy/At, reversalOf?.
- **Uniques:** operationId vía receipt; provider reference.
- **Indexes:** sale/payment/return/status/date.
- **Mutability:** state machine; completado inmutable.
- **Retention/Audit:** permanente.

### Return / ReturnLine

- **Purpose:** devolución física total/parcial independiente del reembolso.
- **Fields Return:** saleId, branch/register, reasonId, status `COMPLETED|CANCELLED`, createdBy/At.
- **Fields Line:** originalSaleLineId, quantity, disposition `RESTOCK|WASTE|INSPECTION`, inventoryMovementId(s).
- **Constraint lógico:** suma devuelta nunca supera vendida.
- **Indexes:** sale, saleLine, date.
- **Mutability:** completada inmutable; cancelarla produce reversal explícito si se permite.
- **Retention/Audit:** permanente.

### InventoryMovement

- **Purpose:** ledger autoritativo de existencia.
- **Fields:** branchId, variant/inventoryItemId, type, signedQuantity Decimal, baseUnit, sourceType/sourceId, operationId, actor, terminal, occurredAt, reversalOfId?, unitCost snapshot.
- **Uniques:** `(operationId, movementComponent)`; reversalOf único cuando solo se permite una reversión total.
- **Indexes:** `(branchId,itemId,occurredAt)`, source, operationId.
- **Mutability/retention:** append-only/permanente. DB role de app sin UPDATE/DELETE futuro.
- **Audit:** el propio movimiento es evidencia; command audit adicional.

### Register

- **Purpose:** unidad lógica/financiera de caja dentro de Branch.
- **Fields:** branchId, code, name, status, defaultCurrency, configurationVersion.
- **Unique:** `(branchId,code)`.
- **Indexes:** branch/status.
- **Mutability:** configurable; no reubicar con historia.
- **Retention/Audit:** soft archive, audit completo.

### Terminal

- **Purpose:** dispositivo autorizado para operar un Register.
- **Fields:** registerId, label, credentialHash/publicKey, status, appVersion, lastSeenAt.
- **Unique:** device identity; label por register opcional.
- **Indexes:** register/status, lastSeenAt.
- **Mutability:** enrollment/revocation.
- **Retention/Audit:** conservar identidad histórica; auditar enrollment/revoke/reassign.

### CashSession

- **Purpose:** periodo operativo de un Register, abierto por usuario/terminal.
- **Fields:** registerId, openingTerminalId/user, status `OPEN|CLOSING|CLOSED`, openedAt/closedAt, openingDeclarationId, closingDeclarationId.
- **Unique:** índice parcial: máximo una OPEN/CLOSING por Register.
- **Indexes:** register/status/date, user/date.
- **Mutability:** solo state machine.
- **Retention/Audit:** permanente.

### CashMovement

- **Purpose:** ledger de efectivo físico de sesión.
- **Fields:** sessionId, type `OPENING_FLOAT|CASH_SALE|CASH_REFUND|INFLOW|OUTFLOW|SAFE_TRANSFER|ADJUSTMENT|REVERSAL`, signedAmount, sourceType/sourceId, reasonId, operationId, actor, occurredAt, reversalOf.
- **Uniques:** operation component; source/payment projection según tipo.
- **Indexes:** session/date/type/source.
- **Mutability/retention:** append-only/permanente.

### CashCut

- **Purpose:** reconciliación/snapshot de una CashSession cerrada; no contiene los hechos originales.
- **Fields:** cashSessionId, expected, counted, difference, totals by method snapshot, status `DRAFT|FINALIZED|REVIEWED`, finalizedBy/At.
- **Unique:** cashSessionId.
- **Mutability:** draft; final inmutable. Revisión agrega resolución, no reescribe hechos.
- **Retention/Audit:** permanente.

### AuditEvent

- **Purpose:** bitácora transversal de comandos y decisiones.
- **Fields:** operationId, actorId, branch/register/terminal, action, aggregateType/id, before/after permitidos, reason, metadata sanitizada, occurredAt.
- **Uniques:** `(operationId,eventSequence)`.
- **Indexes:** aggregate/date, actor/date, branch/date, action/date.
- **Mutability/retention:** append-only; retención legal/operativa permanente o política aprobada.

### CashSafeEnvelope

Conservar los modelos actuales y su ledger. Añadir en una migración aditiva referencias opcionales a `CashSession`, `CashCut v2` y `CashMovement`, sin reemplazar `cashCutId` legacy hasta concluir convivencia.

## Snapshots de SaleLine

Copiar al finalizar: productId/variantId de referencia, product name, variant/presentation, SKU, barcode opcional, quantity display y base, unidad/conversion factor, base unit price, branch override price, final unit price, line subtotal, impuestos (código/tasa/base/monto), cada descuento/promoción (ID+version+nombre+tipo+base+monto), cortesía/empleado y autorización, final line total, recipeVersionId y cantidades de ingredientes consumidas. El snapshot debe ser estructurado en columnas para totales críticos y JSON versionado solo para explicación adicional.

## Interoperación monetaria legacy

Durante convivencia, leer Float legacy mediante conversión decimal desde su representación textual y redondear a centavos con `ROUND_HALF_UP` únicamente en el adapter. Nunca sumar Float legacy con JavaScript `number` para producir un hecho V2. Dual-write compara total V2 Decimal contra legacy dentro de tolerancia documentada de un centavo; diferencias bloquean o van a shadow alert según fase. No se alteran columnas legacy hasta el retiro final.
