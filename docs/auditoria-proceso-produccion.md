# Auditoría del proceso de producción — antes de la prueba real

Recorrido del código siguiendo el camino completo de un lote:
recepción → cocción → molienda → fermentación → destilación → rectificación
→ lote terminado → *(hueco)* → elaboración de licor → embotellado → inventario Veliz.

Fecha: 7 de agosto de 2026.

---

## Resumen para decidir rápido

El proceso de agave (cocción → destilación) **está completo y bien construido**.
Puedes correrlo de principio a fin sin problemas.

Lo que **no existe** es el puente entre ese proceso y el inventario. Un lote
terminado te da litros y un QR, pero esos litros no llegan solos a ningún lado.
Si el objetivo de la prueba es "ver el tequila en el inventario de Veliz", hoy
ese último tramo hay que hacerlo a mano.

| Riesgo | Gravedad | ¿Bloquea la prueba? |
|---|---|---|
| 1. El lote terminado no alimenta la elaboración de licor | **Alta** | Sí, para llegar a inventario |
| 2. Las tinas nunca se marcan ocupadas ni libres | **Alta** | Sí, si usas más de un lote |
| 3. `RawMaterial.currentStock` nunca se mueve | Media | No, pero descuadra costos |
| 4. Prerrequisitos de datos sin validar (sucursal Veliz, vínculo de producto) | **Alta** | Sí, silenciosamente |
| 5. Fermentación no libera equipo (no usa equipo) | Baja | No |

---

## 1. El lote terminado no conecta con la elaboración de licor

**Lo que encontré.** Son dos sistemas separados que nunca se tocan:

- **Proceso de agave:** `Lot` → `Cooking` → `Milling` → `Fermentation` → `Distillation`.
  Al cerrar la rectificación, `finishLot` guarda `Lot.totalLitersObtained` y genera el QR.
  Ahí termina todo.
- **Elaboración de licor:** `LiquorBatch` → `LiquorBottling` → `InventoryEntry`.
  `LiquorBatch` se crea desde una receta (`liquorBatches.ts`), pidiendo litros a mano.

`LiquorBatch` **no tiene campo `lotId`**. No hay ninguna relación en el esquema ni
ninguna acción que convierta un lote terminado en materia prima, en un batch, ni en
inventario.

**Qué significa para tu prueba.** Vas a llegar al final de la destilación con,
digamos, 200 litros registrados en el lote. Para que aparezcan en Veliz tendrás que
ir por fuera a crear una elaboración de licor y capturar esos litros de nuevo,
sin trazabilidad entre uno y otro. Si alguien pregunta "¿de qué lote salió esta
botella?", el sistema no lo sabe.

**Opciones.**

- **Mínima (para la prueba de la semana):** aceptarlo y hacer ese paso a mano,
  anotando el código del lote en las observaciones del batch de licor.
- **Correcta (recomendada):** agregar `lotId` opcional a `LiquorBatch` y un botón
  "Enviar a elaboración" en el lote terminado, que precargue los litros obtenidos.
  Es un cambio acotado: un campo en el esquema, una acción y un botón.

---

## 2. Las tinas nunca se marcan como ocupadas ni libres

**Lo que encontré.** El manejo de tinas es inconsistente entre etapas:

- `MillingDischarge.tankId` apunta a un `Equipment` real (la tina).
- `Fermentation.tank` es **texto libre** (`String`), no una relación.

Cuando registras una descarga a una tina, el equipo **no** se marca `OPERANDO`.
Cuando la fermentación termina, **no** se libera nada, porque la fermentación ni
siquiera sabe qué equipo es — solo guardó el nombre.

Compáralo con las otras etapas, que sí lo hacen bien: cocción, molienda y
destilación marcan el equipo `OPERANDO` al iniciar y `DISPONIBLE` al terminar.

**Qué significa para tu prueba.** Con un solo lote no lo vas a notar. En cuanto
corras dos lotes en paralelo, el sistema te va a dejar mandar mosto de dos lotes
distintos a la misma tina sin avisar, y el tablero de equipos mostrará las tinas
como disponibles aunque estén llenas.

**Sugerencia.** Marcar la tina `OPERANDO` al registrar la descarga y `DISPONIBLE`
al cerrar la fermentación. Para eso la fermentación necesita guardar `tankId`
además del nombre.

---

## 3. `RawMaterial.currentStock` nunca se mueve

**Lo que encontré.** El modelo `RawMaterial` tiene `currentStock`, `minimumStock` y
`averageCost`, y las recetas de licor apuntan a él. Pero **ningún código actualiza
esos campos**: no hay entradas, salidas ni movimientos. El stock se queda en el
valor que se haya capturado a mano.

**Qué significa.** Cuando elaboras un licor, los ingredientes de la receta no se
descuentan de ninguna existencia. El costo de producción que calcules va a ser
teórico, no real.

**Nota:** el inventario de sucursales (`InventoryProduct` + `InventoryEntry`) sí
funciona correctamente y sí se descuenta con las ventas del POS. El problema es
solo con `RawMaterial`, que es un catálogo paralelo para recetas de licor.

---

## 4. Prerrequisitos de datos que fallan en silencio

Estos no son errores de código, son datos que deben existir antes de la prueba.
El problema es que **fallan sin avisar** o con un error críptico.

**a) La sucursal con código `VELIZ` debe existir.**
En `liquorBottling.ts` el abono a inventario busca `branch.code === "VELIZ"`.
Si no existe, lanza un error que **cancela todo el embotellado** — no solo el
abono al inventario, sino el embotellado completo. Verifícalo antes.

**b) `LiquorProduct.inventoryProductId` debe estar configurado.**
Si el producto de licor no está vinculado a su producto de inventario, el
embotellado se completa **sin error y sin avisar**, pero no abona nada al
inventario. Este es el más traicionero: todo parece haber funcionado y el
inventario simplemente no se mueve.

**c) Equipos dados de alta y activos.**
Cocción y destilación necesitan `ALAMBIQUE`; molienda necesita `DESGARRADORA` o
`PRENSA`; las descargas necesitan tinas. Si un tipo no tiene equipos activos, el
formulario de esa etapa aparece con el selector vacío.

**d) Tarifas por hora del personal**, si vas a mirar nómina durante la prueba.

---

## 5. Observaciones menores por etapa

**Cocción.** Sólida. Registra eventos, temperaturas, mieles amargas y dulces,
tiene acta de cierre con código único y análisis de MAESTRO. No le veo huecos.

**Molienda.** Bien resuelta. Maneja descargas múltiples a distintas tinas con sus
mediciones. Único pero: lo de las tinas (punto 2).

**Fermentación.** Registra lecturas de Brix, pH, temperatura y alcohol a lo largo
del tiempo, con gráficas. Dos detalles:
- No usa `Equipment` para la tina (punto 2).
- En `fermentation/new` se cargan **todas** las descargas de molienda de la
  historia sin filtro de fecha ni de etapa. Con pocos lotes está bien; con cientos
  la página se va a poner lenta.

**Destilación.** La más completa: distingue destrozado de rectificación, maneja
cabezas/corazón/colas, calcula rendimiento y alcohol corregido. El encadenamiento
destrozado → rectificación está bien resuelto.

**Cierre de lote.** Correcto y con buenas defensas: valida que la etapa sea
`TERMINADO` y que no se haya cerrado antes, y genera el QR público.

---

## Qué haría yo antes del lunes

**Imprescindible (30 minutos, sin tocar código):**

1. Confirmar que existe la sucursal con código exactamente `VELIZ`.
2. Confirmar que los productos de licor tienen su `inventoryProductId` vinculado.
3. Confirmar que hay equipos activos de cada tipo, incluidas las tinas.
4. Correr un lote de prueba con datos falsos **hoy**, no el día de la prueba.

**Muy recomendable (cambios acotados):**

5. Marcar tinas ocupadas/libres (punto 2) — evita el error más probable en campo.
6. Avisar en pantalla cuando un producto de licor no tenga inventario vinculado,
   en vez de fallar en silencio.

**Se puede esperar:**

7. Conectar lote terminado con elaboración de licor (punto 1).
8. Movimientos de `RawMaterial` (punto 3).

---

## Lo que no pude verificar

Esta auditoría es de código, no de ejecución. Desde mi entorno no tengo acceso a
tu base de datos en Neon, así que **no pude correr el proceso de verdad**. No
verifiqué:

- Que los datos base existan (sucursal Veliz, equipos, productos vinculados).
- El comportamiento real de los formularios en el navegador.
- Rendimiento con volumen de datos real.

Si conectas la extensión de Claude en Chrome, sí puedo operar la app y hacer el
recorrido completo contigo.
