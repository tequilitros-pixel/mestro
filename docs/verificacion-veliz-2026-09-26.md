# Verificación y correcciones — Veliz, 26 de septiembre de 2026

## Alcance y preservación

Veliz tiene operación real. Se revisó en producción con la sesión existente, sin crear ventas, cortes, cancelaciones, movimientos de inventario ni notificaciones. Las escrituras de prueba se ejecutaron exclusivamente contra PostgreSQL local (`127.0.0.1:55441/veliz_audit`) y una instancia local de la aplicación. Los scripts rechazan otra base. No se aplicaron migraciones ni SQL manual en producción.

La fuente se recuperó del candidato que generó el deployment `dpl_CKM1JmR2D4Xqmv7zmPeFt7NpkowR`, `/private/tmp/mestro-transactions-publish.llu2lf`. Se conservó en un commit de base y un manifiesto de 951 archivos. Las correcciones se prepararon en el worktree `codex/veliz-audit-fixes`; el checkout principal y sus cambios previos se preservaron.

## Correcciones aplicadas

- Dashboard: saldo de sobres y legado conforme a la fórmula de Caja Fuerte; filtro de sucursal conserva la sucursal solicitada aunque el gerente tenga varias asignadas.
- Ventas, cancelaciones, entradas, salidas y pagos manuales: bloqueo del corte y comprobación de estado dentro de la transacción. El cierre vuelve a leer pagos y movimientos después de adquirir el bloqueo. Cancelar exige pertenecer a la sucursal para usuarios no ADMIN.
- Sobres futuros: recepción automática al cerrar, con usuario, fecha e ingreso/recepción inmutables, sin duplicar saldo. Los sobres y cortes históricos permanecen intactos.
- Materia prima: movimientos atómicos, bloqueo de existencia y rechazo de consumo superior a la existencia. Dos compras concurrentes conservan el costo promedio ponderado.
- Licores: completar pasos, terminar, pausar/reanudar y embotellar bloquean el lote. Los reintentos no consumen dos veces ni duplican botellas; los lotes terminados no se reabren mediante finalización. Agotar el volumen termina el lote. Las pantallas derivan correctamente el estado de lotes históricos agotados sin reescribirlos; la fecha de cierre considera el último embotellado registrado.
- Costos: volumen final autoritativo, o rectificaciones completas de lotes históricos terminados; no se mezclan destrozado ni corridas activas. Promedio por litro excluye costos en proceso y lotes sin costo registrado.
- Presentación: fecha de corte sin desplazamiento de día; fecha actual de caja con la zona central existente; calendario agrupa las fechas en su semana correcta. No cambió la zona central ni el almacenamiento/conversión de fechas.
- Alertas: se configuró el secreto ausente del endpoint. No se dispararon mensajes de prueba ni se añadió una programación.

## Evidencia de pruebas

**PASS — 399 pruebas automáticas**, 0 fallos, 0 omitidas. Incluye regresiones de volumen, lotes agotados y agrupación semanal. TypeScript y ESLint de los archivos modificados pasaron. El primer build local no pudo leer las variables secretas descargadas como `[SENSITIVE]`; se descartó su salida y se compiló el código fuente en Vercel con las variables de producción.

**PASS — 24 comprobaciones de integración locales**:

1. HTTP/API/base de datos (15): sesión anónima; sucursal no autorizada; apertura y reintento; venta concurrente idempotente; ID reutilizado con otro contenido; cancelación no autorizada; cancelación concurrente única; insuficiencia de stock con rollback; entrada/salida atómicas; cierre concurrente, saldo y recepción únicos; filtro de gerente con dos sucursales; rechazo de ventas y entradas sobre corte cerrado; preservación del corte histórico de referencia.
2. Server Actions/base de datos (7): OPERATOR sin permiso; paso concurrente con un consumo; finalización concurrente con un evento; embotellado concurrente con una producción; prohibición de reabrir un lote terminado; consumo concurrente que supera stock; compras concurrentes y costo ponderado.
3. Carreras al cerrar (2): venta que espera detrás de un cierre rechazada sin venta; cierre que espera detrás de un pago vuelve a leer total y diferencia. La segunda prueba simula un pago concurrente con SQL únicamente en la base local.

La base local usa un rol sin superusuario ni BYPASSRLS, pero no reproduce las políticas RLS de producción. Estos resultados prueban las reglas de aplicación y transacciones; no certifican por sí solos el aislamiento RLS productivo.

Scripts reproducibles: `scripts/veliz-audit-seed.mts`, `scripts/veliz-http-audit.mts`, `scripts/veliz-liquor-http-audit.mts`, `scripts/veliz-close-races.mts`. Las tres primeras pruebas requieren datos iniciales limpios; no ejecutar contra producción. Logs conservados en `/private/tmp/maestro-veliz-*-results.log`, `/private/tmp/maestro-veliz-races.log` y `/private/tmp/maestro-veliz-unit-final.log`.

## Producción y límites

Antes de publicar, Veliz no tenía corte abierto. El POS bloqueó el cobro. Se inspeccionó `CC-VELIZ-2026-09-25-01`: fondo, esperado, contado y fondo siguiente $563; ventas $0; diferencia $0; sobre $0. No se intentó corregir saldos históricos.

La autorización de Server Actions de licores ya estaba presente en la fuente de producción recuperada. El señalamiento de ausencia de autorización del informe inicial correspondía al checkout local divergente; no era evidencia de un bypass en el deployment.

Pendientes operativos: conciliar existencias negativas y completar costos reales; confirmar receta/unidad comercial de HIELO de 1 G antes de cambiarla; completar modalidades de eventos sin artículos. No se inventaron movimientos para resolver datos faltantes. Permanecen sin certificación física el funcionamiento offline del dispositivo real, geolocalización/checadas, impresión/escaneo y entrega programada de notificaciones. Los módulos no cubiertos por estas pruebas conservan los límites descritos en la auditoría inicial.

## Entrega

**PASS — publicación y verificación del dominio.**

- Fuente final: commit `4f63cd1cee1bf37805ef4ec1c72385710a62dee7`; correcciones transaccionales en `04d7be358e9069bad08b69bbdcc200d105574241`; base productiva conservada en `132ca25f0b47d3dbc75afe5c3893f51c32c392a8`.
- Deployment final: `dpl_BVXjL5rM3y8jDHuhdJW9jfBUgAxG`, `mestro-ao0ae6quw-maestro-destiladora-del-norte.vercel.app`, READY. Compilación remota, TypeScript y 151 páginas estáticas completadas. La CLI perdió la conexión durante el seguimiento; la API confirmó READY y se promovió el mismo candidato, sin crear otro deployment.
- Promoción confirmada y resolución de `maestro-destiladora.space` al deployment final, sin error de alias. Ninguna migración; hash del esquema idéntico a la base.
- Revisión autenticada: Dashboard $8,052 = Canoas $252 + Tlaltenango $6,800 + Colotlán $1,000, coincidente con Caja Fuerte; Veliz $0. Fecha del corte de Veliz 25/9/2026; corte de referencia conserva $563 de fondo/esperado/contado/fondo siguiente, $0 de ventas y diferencia. POS de Veliz bloquea cobro por ausencia de corte abierto.
- Lote Mango `LM-23-09-2026-022`: Terminado, 50 botellas y enlace a etiquetas; sin modificar lote ni movimientos históricos. La fecha presentada considera la terminación del último embotellado, además del cierre registrado.
- Costos: total $31,000, volumen 585 L, promedio comparable $40.74/L; $9,000 en proceso quedan fuera del promedio y el lote de 45 L sin costo registrado no se usa para diluirlo. Mi horario agrupa 26–27 de septiembre bajo la semana 21–27 y 28 de septiembre–4 de octubre en su semana siguiente.
- HTTP final: `/login` 200; `/api/cash-cuts` y `/api/push/check-overdue` sin autorización 401. No se llamó el endpoint con el secreto ni se enviaron alertas.
- Consulta de logs del deployment final: sin entradas 5xx en el intervalo revisado. Consola del navegador: sin errores/advertencias capturados. Esto se limita al recorrido realizado.
- Servidor y PostgreSQL de prueba detenidos; datos y logs locales conservados. Worktree disponible para revisar los cambios.

**PENDIENTE — certificación integral:** la aprobación de estos casos no equivale a certificar todos los módulos ni dispositivos. Se requiere conciliación de datos negativos/faltantes, confirmar la presentación real de HIELO (se solicitó al usuario), pruebas físicas y las comprobaciones RLS/roles productivos que no se reprodujeron en el entorno local.
