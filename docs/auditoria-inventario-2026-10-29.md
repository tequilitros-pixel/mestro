# Auditoría de inventario en producción — 29 de octubre de 2026

## Actualización: unificación publicada

Los commits `532ad7ccdb8cde38f4fb74df6c0c3f10d8c7ac05` y `d5a3420305a2a64827c98f57b121780205f494fc` quedaron publicados en el despliegue READY `dpl_5Xu6Ytw6xNHUU4qPY7cEyYsitvXw`. Los cuatro dominios públicos apuntan a ese mismo despliegue. `destiladoradelnorte.com`, `maestro-destiladora.space` y `mestro-beryl.vercel.app` redirigen a `www.destiladoradelnorte.com`, conservando ruta y parámetros. Las rutas `/pos` y `/pos2` redirigen a `/pospress`.

El servidor de `/api/pos/sales` registra toda venta nueva en `InventoryBalance`/`InventoryMovement` V2 aun si una cola sin conexión envía `inventoryMode=legacy`; el campo se conserva únicamente para reconocer reintentos idempotentes anteriores. La apertura de caja, creación de orden y finalización de venta nuevas desde POS2 responden con `POS_VERSION_RETIRED` en producción. No se modificaron ventas, conteos ni saldos históricos en esta publicación. Se verificaron TypeScript, lint de los archivos cambiados, 17 pruebas enfocadas, dos compilaciones READY y las redirecciones HTTP públicas.

Esta publicación unifica la versión del software y el libro de las ventas nuevas. El módulo de stock conserva lectura histórica para 23 combinaciones con saldo positivo sin apertura V2; migrarlas requiere una captura o conciliación auditada para preservar la existencia real. También permanecen pendientes el cálculo de consumo/costo en conteos, las recetas Wixárika y la relación entre limón en kilos y jugo en mililitros descritos abajo. La rama `main` incorpora cambios de Workforce ajenos a esta publicación y no es antecesora de la rama de inventario; una futura publicación desde `main` requiere integrar ambas líneas antes de reasignar los dominios.

## Alcance y fuente

Se revisó el proyecto Vercel `mestro` (`prj_JZj6UlFltTRUKSV9XHRMR94iDg2P`), el código del commit `cf9380ff7aef56c3319ff009737f3a8deb2ce096` y la base PostgreSQL de producción mediante consultas de solo lectura. Se siguieron las rutas POSPress, `/pos`, POS2, entradas, traspasos, anulaciones, conteos semanales y stock mostrado. Las cifras son una instantánea del 29 de octubre; pueden cambiar con nuevas operaciones.

## Resultado de conciliación

| Comprobación | Resultado |
| --- | ---: |
| Saldos `InventoryBalance` revisados | 304 |
| Movimientos `InventoryMovement` revisados | 4,037 |
| Diferencias entre saldo y suma de movimientos | 0 |
| Movimientos donde `antes + delta ≠ después` | 0 |
| Saltos en la secuencia de saldos por sucursal y producto | 0 |
| Saldos cuya unidad difiere de la unidad base del producto | 0 |
| Ventas POS de los últimos 30 días | 389 |
| Ventas con descuento V2 | 376 |
| Ventas solo de cobro personalizado, sin descuento de inventario | 10 |
| Ventas de prueba con corte `TEST-*`, sin descuento | 3 |
| Ventas de catálogo reales sin descuento ni explicación anterior | 0 |
| Compras recientes con movimiento V2 correspondiente | 32 de 32 |
| Traspasos recientes con movimiento V2 correspondiente | 4 de 4 |
| Ventas anuladas recientes con devolución de inventario conciliada | 8 de 8 (7 tuvieron consumo) |
| Ventas POS2 recientes | 0 |

Esto confirma la aritmética del libro V2 en las operaciones revisadas. No demuestra que cada captura represente correctamente la existencia física.

## Hallazgos

### 1. Había tres versiones públicas del mismo sistema — corregido durante la auditoría

`www.destiladoradelnorte.com` servía el commit `cf9380f`, pero `maestro-destiladora.space` servía `9104dac` y `mestro-beryl.vercel.app` servía `78d702d`. Los registros de Vercel muestran tráfico de `maestro-destiladora.space` el 29 de octubre. Los cuatro dominios del proyecto, incluido el dominio raíz que redirige a `www`, quedaron asignados y verificados en el mismo despliegue `dpl_EK1i3YZLo8fNEGRgid6j4nZBqQHv`. Las pestañas ya abiertas y las colas sin conexión de cada dispositivo no pueden verificarse desde el servidor.

### 2. `/pos` aún puede escribir en el libro histórico

`app/pos/page.tsx` monta `PosSellClient` con su valor predeterminado `inventoryMode="legacy"`; `/pospress/page.tsx` lo monta con `inventoryMode="v2"`. `app/api/pos/sales/route.ts` acepta la elección enviada por el navegador. En modo histórico, `lib/pos/v1InventoryGuard.ts` escribe `InventoryEntry` y no actualiza `InventoryBalance`, porque esa llamada no pasa `actorId` ni unidad para activar la ruta V2. No hubo ventas históricas en los últimos 30 días; la última `VENTA_POS` histórica registrada fue el 18 de septiembre. Sigue siendo una ruta operativa capaz de crear divergencia futura.

### 3. El conteo semanal sí ajusta stock, pero informa consumo y costo como cero

`lib/inventory/weeklyCountCutover.ts` reemplaza el saldo V2 por el conteo físico y crea `COUNT_CORRECTION` cuando hay diferencia. En el mismo cierre escribe `entriesQuantity: 0`, `quantityConsumed: 0` y `costTotal: 0` en cada renglón. La pantalla `app/administration/inventory/branch-counts/[id]/page.tsx` muestra “Costo total consumido esta semana” y la acción confirma “consumo calculado”. El conteo `CNT-1792985890561` de Tlaltenango cerró con 30 renglones y costo/consumo almacenados en cero, aunque hubo 16 movimientos de consumo por ventas entre su apertura y cierre. Esto es un error de cálculo/presentación del conteo; no prueba que las ventas dejaran de descontar el saldo V2.

### 4. Los cobros personalizados no tienen receta

El POS solo genera requerimientos de inventario para líneas con `variantId` y sus ingredientes. En 30 días hubo 10 ventas compuestas solo de cobros personalizados sin movimiento de inventario. Algunas descripciones parecen productos físicos (“Charro negro”, “Vaso de refresco”, “Cacahuates”); otras pueden ser cobros de diferencias o servicios. No se pueden convertir automáticamente en movimientos sin identificar cuáles representaban una salida física adicional.

### 5. Dos productos de limón son inventarios independientes

`LIMON` representa kilos de limón (base `G`) y `POS-ING-LIMON` representa jugo de limón (base `ML`); las 54 recetas vinculadas usan el segundo. Una compra de 12 kg de `LIMON` en Tlaltenango el 29 de octubre aumentó ese producto, no el stock de jugo. No hay una conversión de producción entre ambos en el flujo POS revisado. Si el negocio espera que comprar limón aumente automáticamente el jugo disponible, falta definir y registrar el rendimiento real de extracción.

### 6. Recetas y saldos pendientes de configuración

Cuatro variantes activas de “Botellas de Arte Wixárika” consumen `1 UNIT`, mientras su insumo `SUP-BOTELLA-ARTE-WIX` tiene unidad base `ML` y presentación configurada de 1,000 ml por pieza. La validación V2 rechaza esa unidad incompatible al vender; no se debe cambiar el historial de movimientos para ocultarlo. Además faltan saldos iniciales V2 para cuatro combinaciones de sucursal/producto usadas por recetas activas: `POS-ING-RC` en Canoas y Huejúcar, y `SUP-BOTELLA-ARTE-WIX` en Barra y Veliz. En las cuatro, el saldo histórico observado es cero; una venta que los requiera debe bloquearse hasta registrar existencia física válida.

### 7. El módulo de stock todavía combina dos fuentes

`computeStockMatrix` usa `InventoryBalance` cuando existe y, en otro caso, último conteo cerrado más `InventoryEntry`. De 366 combinaciones activas sucursal/producto, 284 usan V2, 23 tienen saldo histórico positivo y 59 no tienen saldo. Los 23 históricos positivos son 22 equipos y el producto `LIMON` en Canoas. Por eso no hay una única fuente para todo el catálogo, aunque las recetas POS activas operan casi totalmente en V2.

### 8. Estado de migraciones y observabilidad

Las dos migraciones de inventario publicadas el 28 de octubre figuran aplicadas. La migración `20261027120000_notifications_and_payroll_signatures`, ajena a inventario, sigue pendiente; no se aplicó durante esta auditoría. El plan de Vercel solo permitió revisar aproximadamente una hora de registros de ejecución; las advertencias recientes de `pg` son deprecaciones y no prueban errores de inventario. No se inspeccionaron colas locales en los dispositivos ni se realizó una compra de prueba que alterase existencias.

## Acciones realizadas

- Se alinearon los cuatro dominios públicos al despliegue `dpl_EK1i3YZLo8fNEGRgid6j4nZBqQHv` y se comprobó su asignación.
- No se modificaron saldos, conteos, ventas, compras, recetas ni movimientos de inventario.

## Corrección recomendada, por orden

1. Hacer que el servidor de ventas decida una única ruta V2 y retirar la elección `legacy` enviada por el cliente; probar `/pos`, `/pospress`, mesas y sincronización sin conexión antes de publicar.
2. Mostrar el consumo real del período desde `InventoryMovement` o cambiar el texto del conteo para indicar que solo reconcilia el saldo; no presentar ceros como consumo calculado.
3. Distinguir claramente “cobro sin inventario” de “venta de producto” y exigir variante con receta cuando haya salida física.
4. Corregir las cuatro recetas Wixárika con una decisión de unidad respaldada por la presentación real; capturar saldos iniciales faltantes solo después de validar existencia física.
5. Definir el proceso de transformación de limón a jugo y su rendimiento si se espera que una compra de kilos alimente las recetas en mililitros.
6. Vigilar ventas aceptadas sin movimiento, diferencias saldo/libro, unidades incompatibles, colas offline pendientes y divergencia de dominios.
