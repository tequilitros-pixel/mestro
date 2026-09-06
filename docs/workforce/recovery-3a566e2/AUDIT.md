# Recuperación de 3a566e2 — 2026-09-06

Rescate local para revisión. No autoriza producción. En esta recuperación no se hizo push, deploy, promoción, cancelación remota ni migración de base de datos. Las consultas a DEV y producción se ejecutaron dentro de `BEGIN READ ONLY` y terminaron con `ROLLBACK`.

## CANONICAL REPO HEAD

Repositorio verificado: `/Users/joseadansanchez/maestro-dev`. Inicio limpio en `workforce-v1-foundation`, `aa6c20a962938bb00d374cedd2f9061471dc4aba`. Origin: `https://github.com/tequilitros-pixel/mestro.git`.

Últimos cinco commits al iniciar: `aa6c20a`, `2c14737`, `05ea794`, `6356b56`, `4965fa0`.

## DOCUMENTS REPO HEAD

Repositorio verificado: `/Users/joseadansanchez/Documents/maestro`, rama `offline-sync-preview`, HEAD `3a566e22c7ce6d7be627267004721902210c6e3b`. Mismo origin. Últimos cinco: `3a566e2`, `6817c51`, `620a90b`, `5535a89`, `a92b149`.

La lectura completa de `git status --short --branch` falló con errores de lectura y `mmap failed: Operation timed out`; por tanto no se certifica un árbol limpio en Documents. No se descartaron archivos, cambios ni stashes. No se modificó su rama ni HEAD.

## 3A566E2 PARENTS

Commit de merge, verificado mediante el objeto Git, no inferido del reporte anterior:

1. `c939ac7e4bfba85fe3cf3b46af3ff45be06cd697` — Publicar POS 2.0, horarios, inventario y mejoras pendientes.
2. `6817c518ea839f09d64aba713ee73cce54e64d6a` — fix(build): use production Workforce clock helper.

Tree: `27c9b25bd3031105bcdb7f45d74f5fc9021f2138`.

## COMMIT AUDIT

`git show --stat --diff-merges=first-parent`: 155 archivos, 18,277 inserciones y 347 eliminaciones. Lista completa: [files-vs-parent1.txt](files-vs-parent1.txt).

Frente al segundo padre hay 37 archivos con cambios propios o incorporados durante el merge. Su diff real completo está en [source-parent2.patch](source-parent2.patch), comprobado con `git apply --numstat`. SHA-256 del archivo archivado: `691f5b14649fe9a012a90eec332ba8664be2b4d74647f7d3916b7cb2447f9f36`.

Los otros 118 archivos del diff contra el primer padre coinciden con el segundo padre: son incorporación de Workforce V1 por merge, no implementación nueva de Branches/Templates/Geofencing. No se reimportaron sobre el canónico. El rediseño global del scheduler de cuatro archivos ya estaba en `aa6c20a`; sólo se incorporaron sus añadidos de plantillas, cuyo diff está en [scheduler-vs-canonical.patch](scheduler-vs-canonical.patch).

La inspección se centró en el delta efectivo, esquema, migraciones, acciones, servicios, UI, permisos y pruebas. No equivale a recertificar todo el sistema heredado por el merge ni a un E2E con base de datos de las funciones nuevas.

## UNRELATED CHANGES

Cinco archivos del delta de 37 son POS/offline ajenos al rescate Workforce: `components/offline/OfflineProvider.tsx`, `components/pos/PosSellClient.tsx`, `lib/offline/status.ts`, `lib/offline/sync.ts`, `lib/offline/types.ts`. Cambian recuperación de cola, identificadores de ventas, reintentos y mensajes. Se conservaron en el parche de evidencia pero se excluyeron del código integrado.

El árbol de Documents también contiene POS2, inventario y otras diferencias heredadas frente al canónico. No se copiaron esos árboles ni sus migraciones. No hubo cambios en esos cinco archivos canónicos. El código de autenticación, elegibilidad y las pruebas más recientes del canónico se conservaron.

## MIGRATION 1 AUDIT

`20260904090000_workforce_branches_templates_geofence` crea enums, columnas de Branch y plantillas, una tabla de configuración legacy y evidencia inicialmente ligada a `TimeClockEntry`. También añade `UserBranch.assignmentType` y `ScheduledShift.breakMinutes`, aunque el runtime nuevo usa `BranchAssignment` y `Shift`.

Es aditiva: no contiene DROP TABLE, DELETE, TRUNCATE ni reescritura de filas históricas. Tiene una FK legacy con `ON DELETE CASCADE`; no ejecuta una eliminación, pero dicha relación permite eliminación futura de evidencia legacy si se elimina su TimeClockEntry. Inserta una configuración por defecto. Los CREATE de tablas, índices y constraints no son todos idempotentes; no debe repetirse manualmente si ya figura aplicada.

DEV tiene una aplicación final con checksum `1ad5fadc277dce47e9df6c637bb2bebec3c48263f9359c57c124ac529bb09380`, igual al archivo recuperado, y dos intentos previos marcados rolled back. Se conservó el SQL aplicado sin editarlo.

`ADD COLUMN IF NOT EXISTS timezone ... NOT NULL DEFAULT ...` no modifica la columna nullable preexistente: DEV y producción siguen con timezone nullable, compatible con el fallback del código y el schema recuperado.

## MIGRATION 2 AUDIT

`20260905090000_canonical_workforce_geolocation` es un puente que depende de la primera, no un reemplazo. Relaja a nullable `timeClockId`/`action`, añade vínculos a ClockEvent/Branch/AttendanceException, campos versionados de política, índices, FKs, check de accuracy, valor OUTSIDE_GEOFENCE y RLS para la evidencia.

No elimina ni reescribe filas. `DROP NOT NULL` relaja una restricción, no borra datos. ClockEvent y Branch usan FK RESTRICT. El permiso de `maestro_runtime` se otorga sólo si el rol ya existe.

DEV tiene aplicación final con checksum `f6f44978d42133f732adad78135cfdadba31fd869be85cdd59ab4280414e6f43`, igual al archivo recuperado. Ambas migraciones son necesarias en ese orden para este schema/runtime; no se deben fusionar o reescribir después de aplicadas en DEV.

## SCHEMA SAFETY

La producción consultada tiene las 13 migraciones del canónico previo, todas con checksum coincidente, y le faltan exactamente estas dos. Las tablas canónicas referenciadas existen. No se detectó una incompatibilidad de nombres en sus prerequisitos, pero esto no es una ejecución de ensayo de DDL ni una aprobación de producción.

Hay deuda de schema: las columnas legacy añadidas por la primera migración (`UserBranch.assignmentType`, `ScheduledShift.breakMinutes`) no están modeladas en Prisma. `WorkforceSettings` queda como estructura de compatibilidad sin uso en el runtime nuevo. Los vínculos de la evidencia son nullable sin una constraint que exija exactamente uno de los modelos de origen; no se verifica por constraint que Branch coincida con el ClockEvent.

DEV tiene además nueve migraciones POS2 aplicadas que no pertenecen a la cadena canónica rescatada (phase3a a phase3i). No se importaron ni borraron para ocultar esta divergencia. Los checksums de todas las migraciones compartidas coinciden y no hay aplicaciones pendientes/fallidas sin resolver. `prisma migrate status` por sí solo no certifica ausencia de drift.

## BRANCH MANAGEMENT AUDIT

Existen creación, edición, desactivación, timezone IANA, dirección/código, geozona, plantilla default y lista de asignaciones HOME/ALLOWED. Todas las acciones nuevas exigen ADMIN y ejecutan sus operaciones con `withRlsContext`. El default template se valida activo y perteneciente a la sucursal. Geozonas compartidas se separan antes de editarlas. No existe acción nueva que elimine Branch físicamente.

Pendientes: contar asignaciones no garantiza contar empleados únicos/Employment activo; el Clock y la aplicación de plantillas no comprueban consistentemente `Branch.active`, por lo que desactivar no bloquea todos los caminos de escritura. El panel conserva el objeto seleccionado al refrescar y debe probarse tras crear una plantilla. No se hizo QA visual/browser.

## SCHEDULE TEMPLATE AUDIT

La plantilla es fuente de copia: `applyScheduleTemplate` crea Shift DRAFT dentro del scheduling service, sin vínculo dinámico al template. Editar bloques del template no actualiza Shifts históricos. Se rechaza el periodo publicado o con publicaciones. No se publica automáticamente. Cada Shift pasa por `validateAssignedShift`, que verifica Employment, rango de asignación, periodo y traslapes absolutos entre todas las sucursales.

Las advertencias de disponibilidad siguen calculándose en el board y al publicar; el comando de aplicar plantilla no devuelve las advertencias directamente. Las pruebas canónicas de overlap, disponibilidad y publicación se conservaron.

Pendientes: no hay validación de lunes en el servicio de aplicación; el guardado comprueba traslapes sólo entre bloques del mismo día (el servicio sí detecta los traslapes reales al aplicarlos); descanso puede superar duración; reutilizar una plantilla legacy multi-sucursal ignora branchId de cada bloque y aplica la sucursal principal. ASK_BEFORE_APPLY usa la semana actual en la pantalla, no la fecha efectiva de la asignación. Aplicar plantilla está oculto bajo `xl` en el scheduler. No se ejecutó integración DB de estos casos ni se incorporó funcionalidad nueva para resolverlos.

## GEOFENCE AUDIT

Los formularios nuevos usan `getCurrentPosition` puntual, sin `watchPosition`, rutas o seguimiento continuo. La evidencia guarda resultado, distancia redondeada, accuracy y hora del servidor; no guarda latitud/longitud exactas del empleado. El servidor calcula la distancia contra la geozona configurada.

Se reprodujo localmente un defecto real del commit original: JSON `{"failure":"INSIDE"}` o `{"failure":"NOT_REQUIRED"}` devolvía allow=true incluso con BLOCK. El cast TypeScript de JSON no valida en runtime. En el rescate se añadió una allowlist de los dos fallos válidos; un resultado autodeclarado ahora se vuelve UNAVAILABLE y BLOCK lo rechaza. Se agregó prueba de regresión.

Permiso denegado, falta de GPS y baja precisión se bloquean con BLOCK o se permiten con evidencia bajo ALLOW_WITH_EXCEPTION. Pendientes: accuracy omitida sigue admitida, timestamp del dispositivo no se valida para frescura y la posición del navegador no constituye atestación antifraude. El kiosk puede solicitar ubicación también al cerrar un break porque decide la acción después de obtenerla.

## CLOCK SECURITY AUDIT

Se mantienen verificación de Employment ACTIVE, propiedad del empleado en clock personal, autorización por BranchAssignment vigente o Shift publicado cercano, máquina de estados, transacción serializable, lock por Employment e idempotency key única. ClockEvent sigue append-only: triggers block_update y block_delete comprobados en DEV y producción. No se añadieron writes legacy ni dual-write.

Pendientes importantes: el kiosk construye un actor ADMIN para cualquier host autenticado tras validar PIN del empleado (comportamiento heredado, no introducido por el delta); los duplicados se comparan por Employment/tipo pero no branch/source; no se comprueban todos los límites efectivos de Employment ni Branch.active. Las excepciones geofence nuevas usan derivationVersion=1: el reconciliador general puede auto-resolverlas después por no estar en sus fingerprints esperados. Si se desactiva requireOutsideGeofenceReview, ALLOW_WITH_EXCEPTION no crea AttendanceException, sólo evidencia. Se requiere corrección y certificación antes de producción.

## RLS AUDIT

La nueva evidencia tiene políticas SELECT/INSERT own-or-admin y UPDATE admin. `recordClockEvent` y `applyScheduleTemplate` establecen contexto transaccional; las acciones de Branch usan `withRlsContext`.

Hecho comprobado: en DEV no existe `maestro_runtime`; la conexión disponible es owner y la evidencia no tiene FORCE RLS. No se puede certificar enforcement de runtime con ese entorno. En producción sí existe `maestro_runtime`, sin SUPERUSER ni BYPASSRLS, con permisos sobre las tablas Workforce consultadas. ClockEvent/Employment/BranchAssignment/Branch/ScheduleTemplate/ScheduleTemplateShift tienen RLS desactivado tanto en DEV como en producción. Establecer contexto no agrega por sí mismo políticas. No se alteraron roles, grants ni políticas durante esta recuperación.

## CURRENT VERCEL PRODUCTION

Consulta read-only de alias: `maestro-destiladora.space` sirve `dpl_4YmDrWdz13V7g3GSzP3ESwJYgRXq`, READY, target production, commit `12682435c73d5fe9bd16c4a022d9d6171e301d0b`, rama offline-sync-preview. URL: https://mestro-rj8875yuv-maestro-destiladora-del-norte.vercel.app. Creado 2026-09-05 21:19:41 America/Mexico_City.

Aliases: maestro-destiladora.space, mestro-beryl.vercel.app, mestro-maestro-destiladora-del-norte.vercel.app, mestro-git-offline-sync-preview-maestro-destiladora-del-norte.vercel.app.

## CANCELLED DEPLOYMENT STATUS

No aparece un deployment del intento ni del SHA 3a566e2 en los 20 más recientes, que cubren desde antes de la creación del commit hasta la consulta. El más reciente es la producción anterior. ID/environment/alias del intento: no existen en la lista consultada. No se canceló ni promovió nada remotamente.

## CANONICAL INTEGRATION METHOD

Git fetch local normal falló por mmap/lectura del repositorio origen. Un intento filtrado tampoco completó y fue cancelado; se retiró únicamente la sección de remote temporal creada por ese intento en la configuración canónica. No se borraron objetos ni datos.

Se creó `codex/recover-workforce-3a566e2` desde `aa6c20a`. Integración por parche Git selectivo después de inspeccionar el delta: se aplicaron los cambios Workforce relativos al padre 2, excepto los cuatro archivos del scheduler (se aplicó su delta contra aa6c20a) y permisos (se añadió sólo la nueva ruta Branches sobre la versión canónica). Los cinco archivos POS/offline quedaron excluidos. Ningún archivo de `tests/workforce/` se modificó.

Commit de recuperación: `765552f`, con Source-Commit y Base-Canonical en el mensaje y parches completos de procedencia versionados. El SHA de merge original no se importó íntegro a la base de objetos canónica; su cambio de Workforce sí se recuperó de manera rastreable. No se hizo cherry-pick ciego del merge ni copia del árbol de Documents.

## FINAL CANONICAL HEAD

El HEAD final es el commit que contiene este reporte y las correcciones de seguridad/compatibilidad, en `codex/recover-workforce-3a566e2`; su SHA se entrega en el checkpoint final. La rama original workforce-v1-foundation permanece en aa6c20a.

## WORKFORCE TEST COUNT

Baseline canónico ejecutado: 186/186. El origen omite cinco archivos del canónico, con 15 pruebas: adminAuthorizationRedirect (1), employmentActions (1), schedulePresentation (3), schedulerEligibility (3), schedulerUx.next (7). Esto explica exactamente 171 frente a 186; no era equivalente al HEAD vigente.

Además, `tests/**/*.test.ts` expandido por el shell de npm omitía archivos directamente en tests/, incluidas las cuatro pruebas nuevas (14 casos). Se hizo explícita la inclusión de tests raíz y tests/workforce, y se añadió `test:workforce`.

Resultado recuperado: Workforce 201/201 (186 + 14 + 1 regresión). Suite completa 231: 230 pasan, 1 falla en `tests/permissionsNavigation.test.ts`, ruta `/administration/workforce` sin catálogo/protección. El código determinante para esa ruta es idéntico al baseline; el delta de permisos sólo añade Branches. Es un fallo anterior ahora visible, no una razón para eliminar la prueba. No se cambiaron expectativas ni se redujo cobertura.

## TYPESCRIPT

Primera ejecución standalone detectó dos TS2345 en el script E2E: su objeto policyValues no copiaba los cinco campos nuevos. Se actualizó el objeto para preservar esos valores desde basePolicy, sin ejecutar el script ni escribir datos. La fase TypeScript posterior de Next build terminó correctamente en 48 segundos. No se ocultaron errores ni se excluyeron scripts del tsconfig.

## ESLINT

Focalizado sobre todos los archivos TS/TSX recuperados: PASS. Segunda revisión de la corrección geofence, prueba y script E2E: PASS.

## PRISMA

validate: PASS. generate: PASS (Prisma Client 7.9.1). migrate status DEV: PASS, 15 migraciones locales, sin pendientes. Checksums compartidos: todos coinciden. Esto no elimina los nueve registros POS2 adicionales ni el drift legacy descritos arriba. No se ejecutó migrate deploy/dev/reset/resolve en esta recuperación.

## LOCAL BUILD

Build de producción local ejecutado con DATABASE_URL, DATABASE_URL_UNPOOLED y MIGRATION_DATABASE_URL fijados explícitamente al endpoint DEV verificado. Compiló correctamente en 74 segundos y pasó TypeScript. Falló después, en page-data collection de `/forgot-password`: falta `RESEND_API_KEY` para construir Resend. Resultado total FAIL por configuración local de correo. No se inventaron credenciales ni se modificó autenticación para ocultar el bloqueo.

## GIT STATUS

Documents conserva HEAD, rama y archivos; se verificó `stash@{0}: workforce-branches-templates-geozones-wip`. Su status completo no pudo certificarse por timeouts. Canónico: recuperación y correcciones en rama local separada; sin push. Todos los archivos existentes bajo tests/workforce y las áreas POS/offline excluidas siguen idénticos a aa6c20a. Los espacios de contexto en los `.patch` archivados son propios del formato unified diff y se conservaron deliberadamente.

3A566E2 SAFELY RECOVERED: YES (delta Workforce selectivo; no certificación funcional de producción)
READY FOR PRODUCTION MIGRATION: NO
