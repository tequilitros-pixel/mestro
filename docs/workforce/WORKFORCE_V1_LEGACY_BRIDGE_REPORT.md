# Workforce V1 — Legacy Bridge / Shadow Validation

Fecha: 2026-08-26
Alcance: lectura, transformación, comparación y reporte. Esta fase no hace dual-write, cutover ni migración de producción.

## Decisión

**YES WITH CONDITIONS.** El puente es viable para shadow validation y para preparar una migración posterior, pero no debe hacer cutover hasta definir identidad laboral, moneda, política de fecha de negocio y tratamiento auditable de checadas compuestas/correcciones.

## Matriz de mapeo

| Legacy | Candidato Workforce | Clasificación | Condición o pérdida conocida |
|---|---|---|---|
| `User` | `Employee` + `Employment` candidato | `AUTO_MIGRATION_WITH_NULL_UNKNOWN` | No separar nombres ni inventar fecha de ingreso; estado laboral queda `LEGACY_UNKNOWN`. |
| `SalaryRate` | `PayRate` | `AUTO_MIGRATION_WITH_NULL_UNKNOWN` | Tipo, monto y vigencia son derivables; moneda no existe en legacy. Gaps/overlaps se reportan. |
| `ScheduledShift` | `Shift` | `AUTO_MIGRATION_WITH_NULL_UNKNOWN` | Fecha de negocio y horario son derivables con zona IANA; descanso planeado y revisión histórica no existen. |
| `ScheduleWeek` | `SchedulePeriod` por sucursal | `AUTO_MIGRATION_WITH_NULL_UNKNOWN` | El estado actual existe, pero no el historial de publicación/revisiones. |
| `TimeClockEntry` | `WorkSession` candidato | `AUTO_MIGRATION_WITH_NULL_UNKNOWN` | Es una fila compuesta, no evidencia de eventos originales; break desconocido. No se fabrican `ClockEvent`. |
| `TimeClockEditRequest` | `ClockCorrection` candidato | `REQUIRES_REVIEW` | Falta el ID de evento objetivo; cambios simultáneos de entrada y salida son ambiguos. |
| `OvertimeRecord` | minutos estructurales de overtime de `Timesheet` | `SAFE_AUTO_MIGRATION` | Horas y tiers se convierten a minutos; se conserva estado de aprobación. |
| `PayrollEntry` | comparación con `PayrollLine` | `ARCHIVE_ONLY` / comparación | Es snapshot congelado; sirve como control financiero, no como fuente de reglas Workforce. |

## Shadow sample en DEV

Se ejecutó una transacción sintética, con prefijo `WFTEST-BRIDGE-`, sobre el endpoint DEV autorizado. La transacción creó únicamente datos legacy temporales y terminó en `ROLLBACK`; la comprobación posterior encontró **0 filas residuales**.

- 1 sucursal con `America/Mexico_City`.
- 4 empleados y 4 tarifas.
- 2 periodos de horario/nómina.
- 4 turnos, incluido uno nocturno.
- 4 checadas, incluida una sin salida.
- 1 solicitud de corrección de salida faltante.
- 1 registro aprobado de overtime.
- 1 snapshot de nómina comparable.

## Métricas y divergencias

| Métrica | Resultado | Categoría |
|---|---:|---|
| Conteo de turnos legacy/candidatos | 4 / 4 | `EXPECTED` |
| Diferencias silenciosas en minutos trabajados | 0 | `EXPECTED` |
| Overtime transformado | 120 min | `EXPECTED` |
| Gross legacy / candidato | 800.00 / 800.00 | `EXPECTED` |
| Diferencia gross | 0.00 | `EXPECTED` |
| Sesiones incompletas | 1 | `LEGACY_LIMITATION`, revisión requerida |
| Corrección de punch faltante | 1 | `REQUIRES_REVIEW` |
| Residuos posteriores al rollback | 0 | `EXPECTED` |

Toda diferencia producida por los comparadores recibe una categoría explícita: `EXPECTED`, `POLICY_DIFFERENCE`, `LEGACY_LIMITATION` o `MAPPING_BUG`. La fecha de negocio de un turno nocturno se ancla a `ScheduledShift.date`; para checadas sin turno se deriva con la zona IANA de la sucursal. El comportamiento legacy de nómina agrupa por fecha UTC, por lo que cualquier divergencia frente a fecha local debe clasificarse como `LEGACY_LIMITATION`, nunca ocultarse.

## Calidad de datos y casos no soportados

- `DERIVABLE`: IDs, vigencias, montos, horarios, minutos completos, tiers de overtime y snapshots financieros.
- `MISSING_DATA`: moneda, fecha de ingreso, break y algunos atributos laborales.
- `AMBIGUOUS_DATA`: correcciones que alteran entrada y salida a la vez; asignación laboral cuando un usuario opera en varias sucursales sin vigencia explícita.
- `UNRECOVERABLE_HISTORICAL_DETAIL`: eventos originales del reloj y revisiones/publicaciones históricas del horario.
- No soportado automáticamente: checada con salida anterior a entrada, turno sin zona válida, descansos sin horas, gaps/overlaps de tarifa y snapshots internamente inconsistentes.

## Orden recomendado para una migración futura

1. Acordar moneda, política de identidad laboral y fecha de negocio.
2. Crear `Employee`/`Employment` y asignaciones, preservando desconocidos explícitos.
3. Migrar tarifas después de resolver gaps/overlaps.
4. Migrar periodos y turnos; archivar estado de publicación sin inventar revisiones.
5. Importar checadas compuestas como sesiones/procedencia legacy, no como eventos originales.
6. Revisar correcciones ambiguas e incompletas.
7. Comparar timesheets y payroll contra snapshots congelados antes de autorizar cutover.

## Gate para la siguiente fase

Puede continuar el shadow validation sobre una muestra mayor. No se autoriza dual-write, reemplazo de runtime ni migración de producción con este resultado. El gate de cutover requiere cero `MAPPING_BUG`, resolución de las condiciones anteriores y aprobación explícita.
