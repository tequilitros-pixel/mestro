# POS 2.0 — Contratos de comandos y errores

## Envelope común

Todo comando sensible recibe `{ operationId: UUIDv7, schemaVersion, actorContext, expectedVersion?, payload }`. `actorContext` confiable se deriva de sesión/terminal en servidor, no del body. Output común: `{ operationId, aggregateId, status, version?, committedAt }`.

## Comandos

| Command | Input esencial | Authorization | Idempotency / tx | Output | Errores específicos |
|---|---|---|---|---|---|
| CreateOrder | branch/register/terminal/session | `pos.order.create` SELF | operation; tx corta | Order OPEN | REGISTER_CLOSED, TERMINAL_NOT_ACTIVE |
| Add/Update/RemoveOrderLine | order, expectedVersion, variant, qty | owner o `pos.order.edit.any` BRANCH | operation + optimistic tx | Order+quote stale/updated | VERSION_CONFLICT, PRODUCT_UNAVAILABLE |
| PriceOrder | order, expectedVersion, pricing timestamp/context | `pos.order.edit` | idempotent; read+snapshot tx | explainable PriceQuote | PRICE_NOT_FOUND, PRICE_CHANGED |
| BeginPayment | order/version | `pos.sale.create` | state CAS tx | PAYMENT_PENDING | INVALID_STATE_TRANSITION |
| VoidOrder | order/version/reason | SELF o `pos.order.void.any` | state tx | VOIDED | PAYMENT_ALREADY_CAPTURED |
| CompleteSale | order/version, quoteVersion, confirmed tenders | `pos.sale.create` BRANCH | obligatorio; una tx central | Sale, receipt, ticket model | ver diseño transaccional |
| CancelSale | sale, reason, approval? | `pos.sale.cancel` BRANCH | obligatorio; compensación en tx | Cancel document/status | WINDOW_EXPIRED, ALREADY_RETURNED |
| CreateReturn | sale, lines/qty/disposition/reason | `pos.return.create` BRANCH | obligatorio; locks de returnable+stock | Return | RETURN_QUANTITY_EXCEEDED |
| IssueRefund | payment, amount, reason, return? | `pos.refund.create` BRANCH y approval según monto | operation; cash tx / external saga | Refund | REFUND_AMOUNT_EXCEEDED, PAYMENT_NOT_REFUNDABLE |
| OpenCashSession | register, terminal, declaration | `cash.session.open` BRANCH | operation; unique open tx | CashSession OPEN | SESSION_ALREADY_OPEN |
| CreateCashMovement | session, type, amount, reason | capability por tipo | operation; tx ledger | movement | REGISTER_CLOSED, INVALID_AMOUNT |
| CloseCashSession | session, counted denominations, envelope instruction | `cash.session.close` BRANCH | operation; locks; tx | Cut FINALIZED + envelope pending | SESSION_NOT_RECONCILABLE |
| TransferInventory | branches, item, qty | `inventory.transfer` scope ambas | operation; balance locks tx | transfer/movements | INSUFFICIENT_STOCK |
| AdjustInventory | branch/item/delta/reason | `inventory.adjust` BRANCH | operation; balance lock tx | movement/new balance | ADJUSTMENT_LIMIT_EXCEEDED |
| PublishPrice | draft/version/scope | `pricing.publish` scope | operation; tx validity checks | published Price | OVERLAPPING_PRICE |

## Idempotencia completa

- Generador: cliente/terminal antes del primer intento para comandos interactivos; servidor para jobs internos. UUIDv7 canónico lowercase.
- Scope/unique: `(organizationId, operationId)` global; una key no se reutiliza entre commands.
- Storage: `OperationReceipt` con commandType, payloadHash SHA-256 de JSON canónico, status `IN_PROGRESS|COMPLETED|FAILED_FINAL`, result JSON mínimo, aggregate IDs, timestamps.
- Expiración: receipts financieros/inventario/caja no expiran; drafts no sensibles pueden archivarse después de política aprobada.
- Claim: insertar receipt en la misma tx o reservar mediante insert unique. Un concurrente espera/consulta resultado; nunca ejecuta dos veces.
- Replay: misma command+hash y COMPLETED devuelve status/body semánticamente idéntico. `IN_PROGRESS` devuelve 409/202 con retryAfter. FAILED_FINAL reproduce error estable.
- Hash diferente: `IDEMPOTENCY_KEY_REUSED` no retryable, con ningún write de negocio.
- Retry: cliente conserva key hasta resultado terminal; servidor reintenta solo deadlock/serialization/transient DB con backoff y misma key.
- Subcomponentes usan ordinal determinista, por ejemplo `operationId + inventory:03`, con unique correspondiente.

## Error model

Formato: `{ error: { code, message, retryable, operationId, details? } }`; message localizado no es contrato. Details nunca filtra otra branch o secretos.

| Code | HTTP sugerido | Retryable | Significado/acción |
|---|---:|---|---|
| INSUFFICIENT_STOCK | 409 | No hasta cambiar stock/order | mostrar faltantes permitidos |
| PRICE_CHANGED | 409 | Sí tras reprice/confirmación | devolver quote nuevo |
| REGISTER_CLOSED | 409 | No | abrir/seleccionar sesión |
| TERMINAL_NOT_ACTIVE | 403 | No | enrollment/soporte |
| DUPLICATE_OPERATION | 200 replay | — | resultado existente |
| OPERATION_IN_PROGRESS | 409/202 | Sí | poll/backoff |
| IDEMPOTENCY_KEY_REUSED | 409 | No | generar key solo para nueva intención |
| PAYMENT_MISMATCH | 422 | No | corregir tenders |
| PAYMENT_STATUS_UNKNOWN | 409 | Sí vía reconcile, no recobrar | investigar proveedor |
| REFUND_AMOUNT_EXCEEDED | 409 | No | recalcular refundable |
| RETURN_QUANTITY_EXCEEDED | 409 | No | recalcular returnable |
| PERMISSION_DENIED | 403 | No | solicitar autorización |
| RESOURCE_NOT_FOUND | 404 | No | uniforme para cross-branch |
| INVALID_STATE_TRANSITION | 409 | No | refrescar aggregate |
| VERSION_CONFLICT | 409 | Sí tras reload | optimistic concurrency |
| WRITE_CONFLICT | 503 | Sí | retry servidor/cliente acotado |
| VALIDATION_ERROR | 422 | No | corregir input |
| INTERNAL_ERROR | 500 | Condicional | correlation ID; no detalles internos |
