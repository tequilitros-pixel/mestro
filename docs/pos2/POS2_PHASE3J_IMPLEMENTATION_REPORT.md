# POS 2.0 — Reporte de implementación Fase 3J

## Entregables

- Política explícita por command y `CompleteSale` online-only.
- Drafts, queue, mappings, cache y metadata persistentes en IndexedDB v2.
- UUIDv7 previo al primer send, canonical serialization y SHA-256.
- Causal ordering, compaction segura, retry/backoff y conflict taxonomy.
- Web Locks con fallback de lease para coordinación multi-tab.
- Replay mediante OperationReceipt y endpoint POS2 restringido a commands offline aprobados.
- Reachability real, ETag de configuración y diagnostics local.
- Superficie DEV `/administration/pos2/sync` y fallback PWA sin afirmaciones financieras.
- Service worker endurecido: no cachea páginas autenticadas ni APIs.

## Límites

No hay venta financiera offline, captura offline, impresión oficial offline, merge automático, WebSocket, rollout, dual-write V1 ni UI final. POS V1 y la cola legacy continúan aislados.

## Validación

- TypeScript global: PASS.
- ESLint focalizado: PASS.
- Suite normal: 87/87 PASS.
- Dominio offline/sync: 11/11 PASS, incluyendo causalidad, compaction, backoff, canonicalización, 1,000 commands y un solo leader multi-tab.
- PostgreSQL 3J: 3/3 tests PASS; commit con respuesta perdida reproduce un único resultado/AuditEvent y payload distinto rechaza el operationId reutilizado.
- Next.js production build: PASS, 120 páginas estáticas y las nuevas rutas sync.
- No se requiere migración PostgreSQL. IndexedDB migra a schema local v2 mediante `onupgradeneeded` sin borrar stores existentes.
- No se añadió Playwright porque no existe esa infraestructura/dependencia en el repositorio; la superficie browser queda compilada y sus reducers/coordinación están cubiertos unitariamente.
