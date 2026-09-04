# POS 2.0 — Reporte de implementación Fase 3A

Fecha: 2026-08-30. Rama `offline-sync-preview`, HEAD inicial `9006d37ee143a9e6dafb16ea91577789d545c50f`.

## Resumen

Se implementó contención incremental del POS V1 y la infraestructura base V2 sin reemplazar el POS, alterar Float legacy, desplegar ni escribir en producción. La validación posterior de Fase 3A.1 se completó sobre PostgreSQL DEV local aislado con resultado **PASS**; evidencia detallada en `POS2_PHASE3A_DEV_VALIDATION.md`.

## Contención V1

- Cancelación movida a un servicio transaccional: contexto RLS, `FOR UPDATE` sobre Sale, comprobación de estado dentro del lock y compensaciones una sola vez. El segundo request devuelve la Sale cancelada con `duplicate=true`.
- La primera venta online genera `clientOperationId` antes del submit. `PosSale.id` sigue siendo el constraint único y `clientPayloadHash` detecta reutilización con otra intención. P2002 concurrente recupera y reproduce la Sale existente.
- Stock V1: advisory lock transaccional por `branchId:inventoryProductId`, claves ordenadas, cálculo bajo lock usando último conteo cerrado + ledger posterior, rechazo `INSUFFICIENT_STOCK` y consumo en la misma tx. Es una contención sin crear balance temporal; POS2 migrará a `InventoryBalance FOR UPDATE`.
- Autorización server-side agregada a catálogo POS, productos de inventario, conteos, ajustes/entradas, paquetes de evento y kits de equipo. Se reutilizan ADMIN y ModulePermission legacy.

## Fundamentos V2

- `Money`: wrapper inmutable de `Prisma.Decimal`, MXN, escala 2, `ROUND_HALF_UP`, parsing por string/bigint/Decimal, operaciones explícitas, serialización estable y adapter Float legacy explícito.
- `Quantity`: Decimal inmutable, escala 6, `UNIT|ML`, operaciones solo entre unidades iguales y validación no negativa opcional.
- `DomainError`: códigos, mensajes seguros, retryable, HTTP y metadata escalar segura.
- `OperationReceipt`: UUIDv7, command, SHA-256 de JSON canónico, estado/resultado/contexto. Claim concurrente usa `INSERT ... ON CONFLICT DO NOTHING` y lock; payload distinto devuelve `IDEMPOTENCY_KEY_REUSED`.
- `AuditEvent`: helper central, metadata sanitizada y trigger DB que impide UPDATE/DELETE.
- `OutboxEvent`: escritura con TransactionClient; consumidor básico reclama con `FOR UPDATE SKIP LOCKED`, marca PROCESSING/PROCESSED/FAILED y entrega event ID para consumo idempotente. Semántica at-least-once.
- Capabilities: catálogo inicial, grants por usuario o rol, scopes SELF/BRANCH/MULTI_BRANCH/GLOBAL. Solo shadow; venta/cancelación comparan contra autorización legacy y agregan AuditEvent cuando divergen.

## Migración

Creada `20260830090000_pos2_phase3a_foundations`: columna nullable `PosSale.clientPayloadHash`; enums y tablas `OperationReceipt`, `AuditEvent`, `OutboxEvent`, `Capability`, `CapabilityGrant`; checks, índices, FK restrict, trigger append-only y catálogo inicial de capacidades.

Se aplicó dos veces desde cero en PostgreSQL DEV efímero y exclusivamente local. En ambas reconstrucciones las tres migraciones del repositorio finalizaron correctamente. `migrate status` quedó al día y `migrate diff` no detectó diferencias. No se conectó ni escribió en producción.

## Verificaciones

- 47 pruebas unitarias/modelo pasan.
- 10/10 pruebas de integración PostgreSQL pasan: cancelación doble, stock=1, idempotencia, rollback, Audit, Outbox, capabilities, compatibilidad legacy y locks multi-producto/cross-branch.
- `prisma validate`, `prisma generate`, `migrate status`, `migrate diff`, TypeScript focalizado, ESLint focalizado, build Next.js y `git diff --check`: PASS.
- La toolchain se restauró reproduciblemente con `npm ci` en una copia temporal fuera de la carpeta sincronizada.
- La prueba real detectó y permitió corregir el retorno `void` del advisory lock para compatibilidad con adapter-pg.

## Compatibilidad y riesgos

- V1 conserva rutas, modelos y UX. Las nuevas escrituras Audit/Outbox requieren que la migración se aplique antes de desplegar el código; código y migración deben viajar juntos.
- Advisory locks dependen de PostgreSQL, coherente con el datasource actual. Cualquier otro escritor de inventario que no use la misma clave puede competir; la garantía obligatoria se limita por ahora a ventas POS concurrentes.
- `clientPayloadHash` es nullable para historia legacy. Ventas antiguas con un ID cliente idéntico y hash null se reproducen por compatibilidad.
- Outbox es at-least-once; handlers futuros deben deduplicar por event ID.
- `FAILED_FINAL` está reservado; el helper actual revierte receipt junto con fallos del comando para permitir retry limpio.
- Capabilities sin grants niega en shadow y genera discrepancias; no bloquea.

## Deuda antes de deploy/revisión final

1. Confirmar tamaño/retención de AuditEvent y Outbox payloads.
2. Añadir comando de recuperación de eventos Outbox atrapados en PROCESSING.
3. Seed/backfill de CapabilityGrant antes de analizar métricas shadow.
4. Vigilar la advertencia deprecatoria de `pg` sobre consultas simultáneas antes de pg 9.

Producción no fue modificada.
