# POS 2.0 — Arquitectura de Pricing V2 (Fase 3D)

## Source of truth y frontera legacy

`PriceVersion` es la única fuente de verdad de precio base V2. `PosProductVariant.price Float` continúa siendo la fuente legacy de POS V1 y no fue modificado ni conectado al cobro V2. Descuentos, cortesías, precio de empleado, promociones y cálculo fiscal no forman parte de esta fase.

Los importes V2 se persisten como `Decimal(18,2)` y entran/salen del dominio mediante `Money`, con MXN y `ROUND_HALF_UP`. El contrato actual es tax-inclusive: el importe publicado es el precio final mostrado antes de beneficios. Esto documenta la operación existente; no pretende sustituir un motor fiscal.

## Modelo publicado y append-only

Una `PriceVersion` contiene objetivo, scope, importe, moneda y ventana `[validFrom, validTo)`. Producto y precio son entidades separadas. El objetivo es exactamente uno:

- `PRODUCT:<id>` para una resolución solicitada explícitamente por producto;
- `VARIANT:<id>` para una resolución solicitada explícitamente por variante.

Una variante nunca hereda silenciosamente el precio de producto. Los carritos futuros que vendan presentaciones deben resolver por `variantId`.

Los registros publicados no admiten `UPDATE` ni `DELETE`, reforzado por trigger PostgreSQL. Una finalización anticipada crea un `PriceVersionTermination` append-only; cancelar una programación futura se representa terminándola exactamente en `validFrom`. El estado `CURRENT`, `SCHEDULED`, `EXPIRED` o `ENDED` se deriva del tiempo y no puede desincronizarse.

## Scope, precedencia y resolución

Los scopes son `GLOBAL` y `BRANCH`. Para un objetivo, sucursal, moneda y timestamp explícitos, la resolución es:

1. versión BRANCH vigente;
2. versión GLOBAL vigente;
3. error `PRICE_NOT_CONFIGURED`.

El resultado incluye `priceVersionId`, importe, moneda, `taxIncluded`, timestamp y explanation `BRANCH_OVERRIDE` o `GLOBAL_BASE_PRICE`. La ausencia nunca se convierte en `$0`. El inicio es inclusivo y el fin exclusivo.

`resolvePricesBatch` agrupa objetivos en una sola consulta y aplica la misma selección pura en memoria; evita N+1. En PostgreSQL DEV resolvió 2,000 variantes en 35.2 ms (medición orientativa, no SLO de producción).

## No-overlap y concurrencia

El trigger `PriceVersion_no_overlap` toma `pg_advisory_xact_lock` sobre `targetKey|branchKey|currency` antes de buscar intersecciones con `tstzrange`. La búsqueda considera tanto `validTo` como una terminación anticipada. Esto serializa escritores concurrentes y protege incluso escrituras SQL que no pasen por los commands.

La terminación usa la misma llave y valida que su momento esté dentro de la ventana original. Los commands además son idempotentes mediante `OperationReceipt` UUIDv7 y payload hash. Un retry idéntico reproduce el resultado; reutilizar la llave con otro payload falla.

## Tiempo empresarial

PostgreSQL/Prisma persisten instantes normalizados y la API intercambia ISO-8601. La UI usa `datetime-local` y el runtime presenta con `America/Mexico_City`, timezone actual de la empresa. La semántica `[inicio, fin)` evita doble precio en fronteras exactas; cualquier expansión multi-timezone debe introducir timezone por sucursal antes del rollout.

## Permisos, auditoría y shadow

Capabilities: `pricing.view`, `pricing.create`, `pricing.edit_future`, `pricing.end`, `pricing.branch_override` y `pricing.history.view`, además de la capability legacy `pricing.edit`. Una publicación GLOBAL exige grant GLOBAL explícito; una publicación BRANCH exige acceso a la sucursal y ambas capabilities de creación/override.

Publicar y finalizar escriben `AuditEvent` en la misma transacción. `validateLegacyPriceShadow` compara Money legacy contra el precio efectivo V2 y registra `pricing.shadow_mismatch`; no modifica V1 ni participa en su transacción de venta.

## Superficie funcional

- `POST /api/pos2/pricing`
- `POST /api/pos2/pricing/[id]/end`
- `GET /api/pos2/pricing/resolve`
- `/administration/pos2/pricing`: publicación, vigencias, preview temporal, historial y finalización.

La lógica reside en `lib/pos2/pricing`; routes y componentes sólo adaptan transporte/formularios.
