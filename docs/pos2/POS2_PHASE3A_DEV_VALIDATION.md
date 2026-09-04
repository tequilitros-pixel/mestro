# POS 2.0 — Validación PostgreSQL DEV de Fase 3A

Fecha: 2026-08-30. Rama `offline-sync-preview`. Resultado: **PASS**.

## Límite y seguridad

La validación se ejecutó en un PostgreSQL efímero local creado exclusivamente para Fase 3A.1. No se consultó ni modificó producción, no hubo deploy y no se inició Fase 3B, Register ni Terminal.

Identidad demostrada antes de cualquier escritura:

| Propiedad | Valor comprobado |
|---|---|
| Servidor | Docker local, `127.0.0.1:55433` |
| Motor | PostgreSQL 16.15, aarch64 |
| Base | `maestro_pos2_dev` |
| Usuario | `maestro_dev` |
| Esquema | `public` |
| Estado inicial | 0 tablas; `_prisma_migrations` inexistente |

El perfil productivo documentado usa la base `neondb` en Neon. Nombre de base, host y naturaleza del servidor son distintos. La comparación se hizo sin imprimir secretos y sin abrir una conexión productiva.

## Toolchain reproducible

Para evitar los archivos `compressed,dataless` de la carpeta sincronizada, se creó una copia mínima en `/tmp/maestro-pos2-phase3a1.7Fb0iz`, sin `.env`, `.git`, `.next` ni `node_modules`. `npm ci --ignore-scripts --no-audit --no-fund` instaló 699 paquetes desde `package-lock.json`. Todas las comprobaciones siguientes se ejecutaron ahí con Prisma 7.9.1 y Next.js 16.3.1.

## Revisión manual de la migración

Migración: `prisma/migrations/20260830090000_pos2_phase3a_foundations/migration.sql`.

- Es aditiva: agrega una columna nullable, tres enums, cinco tablas, índices, checks, una FK, un trigger y 13 capacidades seed.
- No elimina, renombra ni reescribe columnas/filas legacy y no altera los `Float` financieros existentes.
- `PosSale.clientPayloadHash` no tiene `DEFAULT` ni `NOT NULL`; conserva ventas legacy y evita backfill/rewrite de datos.
- El `ALTER TABLE` requiere un lock breve de PostgreSQL sobre `PosSale`; debe desplegarse en una ventana controlada aunque no reescriba la tabla.
- Prisma aplica cada migración de forma transaccional en PostgreSQL; enums/tablas/trigger no quedan parcialmente aplicados ante un fallo ordinario.
- `AuditEvent_append_only` bloquea `UPDATE` y `DELETE`; la reversión futura debe preservar la política de retención y no intentar borrar auditoría sin una decisión explícita.
- La FK de `CapabilityGrant` usa `RESTRICT`; los grants no desaparecen por borrar una capacidad.
- El SQL no es idempotente por sí solo y debe ejecutarse únicamente mediante el historial Prisma.

Resultado de revisión: **aprobada para DEV**. No fue aplicada a producción.

## Prisma y migraciones

| Comprobación | Resultado |
|---|---|
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `prisma migrate status` antes | 3 migraciones pendientes |
| `prisma migrate deploy` reconstrucción 1 | PASS, 3/3 |
| `prisma migrate deploy` reconstrucción 2, base limpia | PASS, 3/3 |
| `prisma migrate status` final | PASS, schema al día |
| `prisma migrate diff --exit-code` | PASS, sin diferencias |

Estado posterior: 97 tablas públicas; las tres migraciones tienen `finished_at`; existen `OperationReceipt`, `AuditEvent`, `OutboxEvent`, `Capability` y `CapabilityGrant`; `clientPayloadHash` es nullable; hay 13 capacidades y el trigger append-only está instalado.

## Pruebas PostgreSQL reales

El arnés opt-in está en `tests/phase3aPostgres.integration.ts` y requiere `PHASE3A_TEST_DATABASE_URL`; no puede ejecutarse accidentalmente con el glob unitario normal.

| Escenario | Resultado |
|---|---|
| Dos cancelaciones concurrentes | PASS: una `cancelled`, una `duplicate`; una reversión, un decremento de caja, un Audit y un Outbox |
| Stock exacto = 1, dos ventas | PASS: una venta y un `INSUFFICIENT_STOCK` |
| Idempotencia secuencial | PASS: una ejecución y un replay estable |
| Idempotencia concurrente | PASS: una ejecución y un replay estable |
| Reuso de key con payload distinto | PASS: `IDEMPOTENCY_KEY_REUSED` |
| Rollback Receipt + Audit + Outbox | PASS: ninguna fila sobrevivió |
| Audit append-only | PASS: UPDATE y DELETE rechazados por el trigger |
| Outbox transaccional y dos consumidores | PASS: `SKIP LOCKED` reclamó dos IDs distintos, ambos `PROCESSED`, un intento cada uno |
| Capabilities SELF/BRANCH/MULTI_BRANCH/GLOBAL | PASS; shadow no bloqueó legacy y auditó mismatch |
| `clientPayloadHash` legacy | PASS: venta antigua null y venta nueva con SHA-256 coexistieron |
| Locks multiproducto en orden inverso | PASS: ambas transacciones terminaron sin deadlock |
| Independencia cross-branch | PASS: branch B no esperó el lock equivalente de branch A |

Resultado del contrato PostgreSQL: **10 subpruebas PASS, 0 FAIL**.

La primera ejecución reveló que `pg_advisory_xact_lock` retorna `void`, tipo que adapter-pg no deserializa. Se corrigió `consumePosInventory` proyectando el resultado como `text`; luego se reconstruyó la base y se repitió la suite completa. Durante la doble cancelación, `pg` emitió una advertencia deprecatoria sobre consultas simultáneas en un cliente; no alteró el resultado, pero conviene vigilarla al actualizar a pg 9.

## Verificación de código

- Suite normal: **47/47 PASS**.
- TypeScript focalizado de Fase 3A: **PASS**.
- ESLint focalizado: **PASS**.
- Next.js production build: **PASS**, 101 páginas generadas. La primera pasada confirmó compilación y TypeScript pero requirió una clave Resend; la segunda usó una clave ficticia solo para configuración, sin enviar correo.
- `git diff --check`: **PASS**.

## Limpieza y conclusión

Todos los datos creados usan el prefijo `p3a1` y vivieron únicamente dentro del contenedor efímero. Al cerrar la validación se elimina el contenedor completo; producción permanece intacta.

**Fase 3A.1: PASS.** Quedan como deuda deliberada el recovery de Outbox atascado en `PROCESSING`, retención de Audit/Outbox y el seed real de grants antes de convertir capabilities en enforcement. Nada de ello habilita Fase 3B automáticamente.
