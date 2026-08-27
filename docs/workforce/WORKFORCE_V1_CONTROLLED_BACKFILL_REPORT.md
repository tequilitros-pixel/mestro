# Workforce V1 — Controlled DEV Backfill

Fecha: 2026-08-26

## Resultado

La muestra controlada se ejecutó únicamente en Neon DEV (`ep-red-lake-ats4n9i7…/neondb`). Producción, runtime legacy, Vercel y dual-write permanecieron intactos.

## Schema honesty

- `Employee.displayName` conserva `User.name` sin parser; `firstName` y `lastName` admiten `NULL` histórico.
- `Employment.startedAt = NULL` y `dataConfidence = LEGACY_UNKNOWN` cuando no existe evidencia.
- `PayRate.currency = NULL` representa moneda histórica desconocida. Invariante de aplicación: todo PayRate nativo debe proporcionar código ISO-4217.
- `WorkSession.breakMinutes = NULL` significa desconocido; `0` conserva el significado de cero conocido.
- `WorkSession.origin` distingue `NATIVE_RECONSTRUCTED` de `LEGACY_IMPORTED`.
- Una sesión legacy puede no tener `WorkSessionClockEvent`; no se fabrican hechos observados.
- `WorkforceMigrationRecord` separa idempotencia, clasificación, estado, confianza y review queue del dominio.

La migración `20260826233000_support_honest_legacy_workforce_backfill` es aditiva/nullability-relaxing y fue aplicada solamente a DEV.

## Estrategia

Versión técnica: `workforce-v1-controlled-2026-08-26`. Cada registro usa la llave única `(migrationVersion, legacyModel, legacyId)` y un target ID determinista. Employee/Employment, PayRate y WorkSession se escriben en transacciones lógicas pequeñas junto con su mapping.

PayrollEntry permanece comparison/archive-only: no se usan tarifas actuales ni se inventa moneda para construir PayrollLine. ScheduledShift permanece en review porque la sucursal de muestra no tiene timezone demostrable; tampoco se inventa publicación o revisión histórica.

## Dry-run y muestra

- Universo: 1 branch (`TLALTENANGO`), 4 usuarios con evidencia laboral y 2 periodos de nómina.
- Legacy escaneado: 29.
- `SAFE_WITH_UNKNOWN`: 12.
- `REVIEW_REQUIRED`: 15.
- `ARCHIVE_ONLY`: 2.
- Fallidos: 0.
- Escrituras durante dry-run: 0.

## Persistencia

- 4 Employee con nombre visible sin dividir.
- 4 Employment con fecha inicial desconocida.
- 1 PayRate con moneda desconocida.
- 7 WorkSession `LEGACY_IMPORTED`, break desconocido y sin ClockEvents fabricados.
- 29 WorkforceMigrationRecord: 12 migrados, 15 review, 2 archive-only/skipped.
- Total de filas de dominio creadas en run 1: 16.
- Total de filas de dominio creadas en run 2: 0.

## Review queue

- 1 TimeClockEntry: fecha de negocio no demostrable; acción candidata: confirmar business date. No bloquea otros registros.
- 14 ScheduledShift: timezone de branch ausente; acción candidata: confirmar timezone e importar estado canónico sin publicación histórica. No se migraron automáticamente.

## Paridad posterior

- Employee targets trazables: 4/4.
- WorkSession targets trazables: 7/7.
- Minutos legacy completos: 6,923.
- Minutos persistidos Workforce: 6,923.
- Diferencia: 0.
- ClockEvent links para sesiones legacy: 0.
- Duplicados del segundo run: 0.
- Datos inventados: 0.

## Unknowns e historia no soportada

Siguen explícitamente desconocidos la separación del nombre, fecha de inicio laboral, moneda, breaks, fecha de negocio sin turno/timezone y las revisiones/publicaciones históricas. Payroll histórico no se normaliza a PayrollLine sin evidencia independiente de rate, currency y estado de pago.

## Gate

La muestra cumple idempotencia, trazabilidad, paridad de minutos y cero datos inventados. Antes de diseñar un shadow dual-write completo deben resolverse las zonas horarias de sucursales y definirse validación de aplicación para campos obligatorios nativos. El backfill no debe ampliarse automáticamente mientras esos casos sigan en review.
