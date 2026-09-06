# POS 2.0 — Orden exacto recomendado de implementación

Cada bloque es un PR pequeño. No iniciar sin autorización explícita.

## Estado de ejecución

| Bloque | Estado al 2026-08-30 | Nota |
|---|---|---|
| PR-00 Contención V1 | IMPLEMENTADO / VALIDADO EN DB DEV | Auth server-side, cancel lock, operation ID online y advisory locks de stock |
| PR-01 Tipos Decimal/errores | IMPLEMENTADO | Money, Quantity, UUIDv7/hash y DomainError con pruebas |
| PR-02 Receipt/Audit/Outbox | IMPLEMENTADO / VALIDADO EN DB DEV | Migración reconstruida dos veces; integración PostgreSQL 10/10 PASS |
| PR-03 Capabilities shadow | IMPLEMENTADO BASE / NO ENFORCEMENT | Grants/scopes, catálogo inicial y mismatch auditado en venta/cancelación |
| PR-04 Register/Terminal enrollment | IMPLEMENTADO / VALIDADO EN DB DEV | Token one-use, credencial hasheada, revocación y administración mínima |
| PR-05 CashSession/CashDeclaration/CashMovement | IMPLEMENTADO / VALIDADO EN DB DEV | Locks, ledger Decimal, bridge CashCut/sobre y concurrencia real |
| PR-06 Catálogo global + overrides | IMPLEMENTADO / VALIDADO EN DB DEV | Modelos legacy evolucionados, overrides, administración, preview y performance real |
| PR-07 Pricing Engine V2 | IMPLEMENTADO / VALIDADO EN DB DEV | Versiones Decimal append-only, global/sucursal, vigencias, resolver batch y shadow legacy |
| PR-08 Orders V2 | IMPLEMENTADO / VALIDADO EN DB DEV | Pre-sale state machine, snapshots Pricing, locks/version, recovery y freeze de pago |
| PR-09 Inventory Ledger V2 | IMPLEMENTADO / VALIDADO EN DB DEV | InventoryProduct canónico, ledger append-only, balances, batch, transfer y shadow legacy |
| PR-10 en adelante | NO INICIADO | Sales/Payments y demás fases permanecen fuera de alcance |

## PR-00 — Contención V1

- **Goal:** cerrar riesgos inmediatos sin rediseño.
- **Files/domain:** Server Actions de productos/categorías/conteos, cancel route, sale client/API.
- **Tests:** invocación directa sin permiso, doble cancelación, operationId online.
- **Migration:** solo si se aprueba constraint/idempotency mínimo; preferir PR separado.
- **Risk:** medio por tocar caja/venta actual.
- **Rollback:** revertir cambios aislados; feature flags si aplica.
- **Acceptance:** P0 reproducidos dejan de ocurrir; V1 UX equivalente.

## PR-01 — Tipos Decimal, IDs y contratos puros

- **Goal:** librería sin DB para Money, Quantity, UnitConversion, canonical hash y DomainError.
- **Tests:** property/unit de redondeo, conversión, hash estable.
- **Migration:** ninguna.
- **Risk:** bajo.
- **Acceptance:** cero `number` en APIs internas Money.

## PR-02 — OperationReceipt/Audit/Outbox

- **Goal:** infraestructura idempotente reutilizable.
- **Tests:** replay, hash diferente, concurrencia, rollback audit.
- **Migration:** 01.
- **Rollback:** consumidores off; tablas quedan inertes.

## PR-03 — Authorization capabilities en shadow

- **Goal:** grants/scopes y comparador contra roles actuales.
- **Tests:** matriz y cross-branch.
- **Migration:** 02.
- **Risk:** alto si se vuelve autoritativo prematuramente.
- **Acceptance:** shadow sin divergencias inexplicadas; V1 checks intactos.

## PR-04 — Register/Terminal enrollment

- **Goal:** contexto dispositivo/caja administrable, aún sin exigirlo en V1.
- **Tests:** enrollment/revoke/scope.
- **Migration:** 03.
- **Rollback:** flag off.

## PR-05 — CashSession/CashDeclaration/Cut V2

- **Goal:** separar sesión y reconciliación; adapter a cortes legacy.
- **Tests:** un open/register, doble open/close, expected calculation.
- **Migration:** 04.
- **Risk:** alto; shadow primero.

## PR-06 — Catálogo global + overrides adapter

- **Goal:** identidades estables y lectura V2 desde catálogo actual.
- **Tests:** mapping, branch availability/visibility/order.
- **Migration:** 05.
- **Rollback:** V1 reads.

## PR-07 — Pricing engine puro y datos versionados

- **Goal:** quote determinista/explainable con Price y reglas iniciales.
- **Tests:** precedencia global→branch→rule→promotion→manual, vigencia, conflictos.
- **Migration:** 06.
- **Risk:** financiero; shadow contra precios V1.
- **Acceptance:** diferencias explicadas y aprobadas.

## PR-08 — Order commands

- **Goal:** carrito durable y state/versioning, sin ventas V2.
- **Tests:** transitions/CAS/expiry.
- **Migration:** 07.
- **Rollback:** ruta/flag off.

## PR-09 — Inventory ledger shadow

- **Goal:** ledger/balance, baseline y reconciliador sin bloquear V1.
- **Tests:** movimientos, transfer, count correction, concurrency last item.
- **Migration:** 09 antes de activar.
- **Risk:** muy alto; acta de cutoff.

## PR-10 — Sale/Payment/Return/Refund + financial/cash ledger

- **Goal:** documentos y ledgers sin UI; command handlers.
- **Tests:** invariantes financieras y compensaciones.
- **Migration:** 08 y 10 en PRs de migración separados si el tamaño lo exige.
- **Risk:** alto.

## PR-11 — CompleteSale end-to-end backend

- **Goal:** transacción atómica descrita, aún bajo flag/test harness.
- **Tests:** 20 líneas, mixed, lost response, duplicate, stock race, branch security.
- **Migration:** ninguna adicional esperada.
- **Rollback:** command flag off; no borrar resultados válidos.

## PR-12 — Cash envelope integration

- **Goal:** enlazar Cut V2 con ledger actual de sobres.
- **Tests:** close→one envelope, receive difference, concurrent withdraw.
- **Migration:** 11.
- **Risk:** alto; conservar flujo legacy.

## PR-13 — Offline command envelope

- **Goal:** actualizar IndexedDB/sync con receipts, pending/rejected/review.
- **Tests:** timeout en cada frontera, session expiry, FIFO dependencies.
- **Migration:** client DB version + compatibilidad.

## PR-14 — POS2 UI detrás de flag

- **Goal:** nueva ruta consumiendo commands; no reemplazar V1.
- **Tests:** E2E tablet/keyboard/barcode si se aprueba, accessibility y recovery.
- **Risk:** medio.

## PR-15 — Shadow validation y piloto

- **Goal:** dashboards de reconciliación y una branch/register piloto.
- **Tests:** suite operacional y performance.
- **Migration:** índices/proyecciones 12–13.
- **Rollback:** kill switch; OperationReceipt evita duplicados.

## PR-16 — Rollout gradual

- **Goal:** activar por register/branch con gates.
- **Tests:** smoke por ola, reconciliación diaria.
- **Acceptance:** cero diferencias no explicadas, SLO y seguridad verdes.

## PR-17 — Legacy read-only

- **Goal:** detener nuevas escrituras V1 tras rollout estable.
- **Migration:** 15–16.
- **Risk:** alto.
- **Rollback:** runbook temporal; nunca volver a procesar operaciones ya recibidas.

## PR-18 — Retiro futuro separado

Fuera del alcance inicial. Requiere aprobación, retención, backup, auditoría y plan propio. No eliminar `CashSafeEnvelope`.

## Estado ejecutado: Fase 3H

PR-10 queda parcialmente materializado en la superficie POS2 aislada: `SaleCancellation`, `PaymentReversal`, `Pos2Return`/`ReturnLine` y `Pos2Refund`/`RefundAllocation` son documentos compensatorios append-only. Cancel, Return y Refund están separados, usan locks sobre Sale, respetan cantidades/importes históricos y no reabren sesiones ni reescriben cortes o sobres. Promociones, offline, UI final y rollout continúan pendientes.

## Estado ejecutado: Fase 3I

La capa de promociones y ajustes queda materializada antes de offline: definiciones con versiones inmutables, terminación append-only, scopes global/sucursal, vigencia horaria, targets y exclusiones, precedence/stacking determinista, bundles configurables, descuentos manuales/de empleado, cortesías autorizadas y snapshots históricos en Sale. `CompleteSale` revalida y persiste el ajuste en la misma transacción; compensaciones posteriores conservan el neto histórico. Offline, UI final y rollout continúan pendientes.

## Estado ejecutado: Fase 3J

PR-13 queda materializado como primera generación segura: drafts y ediciones locales persistentes, queue versionada con causalidad/replay, mappings local→server, backoff/conflicts, liderazgo multi-tab, revisiones de configuración y diagnostics. Toda frontera financiera permanece online-required. UI final de cajero y rollout continúan pendientes.

## Estado ejecutado: Fase 3K

PR-14 queda materializado en `/pos2`: shell de cajero aislada y responsive, catálogo/búsqueda/variantes, Order y recuperación, ajustes controlados, cobro cash/card/transfer/mixed, `CompleteSale` con replay seguro de resultado desconocido, recibo, drafts offline/reconnect, conflictos humanos, ventas recientes/compensaciones y operaciones de CashSession. POS V1 permanece intacto y no existe rollout. El siguiente gate es Fase 3L — Certification + Pilot Readiness.

## Estado ejecutado: Fase 3L

PR-15 queda materializado como gate técnico, sin activar piloto: rollout server-side cerrado por defecto en producción, allowlists de branch/register, kill switch también aplicado a requests autenticados de terminal, certificador read-only de receipts/outbox/ventas-pagos/inventario/Orders/CashSessions y runbook de rollback. La implementación y su PostgreSQL DEV pasan; un piloto real permanece NO-GO hasta completar evidencia de datos reales, carga, dispositivos, backup/restore, monitoreo y ownership operativo.
