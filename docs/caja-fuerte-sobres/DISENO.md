# Sobres en Caja Fuerte — diseño completo

Estado: **listo para revisión. Nada de esto está aplicado.** No se tocó
`prisma/schema.prisma` ni `prisma/migrations/` porque ambos están
reservados para Codex (Fase 3, baseline de migraciones) en este momento
— confirmado con `git status` y `git diff` antes de empezar: el schema
tiene 127 líneas sin commitear del módulo de Productos añadidos, y la
carpeta de migraciones está en medio de la reconciliación del baseline.

## 1. Diagnóstico: cómo funciona hoy

No existe un modelo "Sobre". Lo que hay:

- `CashCut.envelopeNumber` — texto libre escrito a mano al cerrar el corte. Sin formato, sin unicidad, sin generación automática.
- `CashCut.envelopeAmount` — monto mandado a sobre en ese cierre.
- `CashSafeMovement` (`DEPOSITO_SOBRE` / `RETIRO`) — el único libro de movimientos, **a nivel sucursal**, no por sobre. Al cerrar un corte con sobre, `app/api/cash-cuts/[id]/cerrar/route.ts` crea un `DEPOSITO_SOBRE` dentro del mismo `update` transaccional del cierre (esto ya está bien hecho). Los retiros se registran manualmente desde `/cash-cuts/safe` sin ligarlos a ningún sobre.
- El saldo de una sucursal se calcula **tres veces, en tres archivos distintos** (`app/api/cash-cuts/safe/route.ts`, `app/api/cash-cuts/dashboard/route.ts`, y el propio POST de retiro), siempre como `sum(DEPOSITO_SOBRE) - sum(RETIRO)`. Ya hoy hay riesgo de que diverjan si alguien cambia una sin la otra.
- `/cash-cuts/envelopes` es un reporte de solo lectura: cortes cerrados con `envelopeAmount > 0`. No es una entidad, es una consulta.

## 2. Modelo de datos nuevo

Dos modelos nuevos, aditivos, sin tocar nada existente salvo agregar
relaciones inversas (ver `schema-additions.prisma`):

### `CashSafeEnvelope`

Una fila por sobre físico. Nace en el cierre del corte, vive para
siempre (nunca se borra).

Campos clave: `code` (único, `HUE-20260819-001`), `branchId`,
`cashCutId` (**único** — 1 sobre por corte, garantiza que un reintento
del cierre no duplique el sobre), `cutDate`, `originalAmount`
(inmutable), `currentBalance` (se mueve con cada movimiento),
`status`, `createdById`/`createdAt`, `receivedById`/`receivedAt`/`receivedAmount`.

### `CashSafeEnvelopeMovement`

Ledger inmutable. Una fila por cada cambio de saldo de un sobre. Nunca
se edita ni se borra una fila existente — toda corrección es una fila
nueva de tipo `AJUSTE_POSITIVO`/`AJUSTE_NEGATIVO`.

Campos: `envelopeId`, `type`, `amount` (siempre positivo, el signo lo
da `type`), `previousBalance`, `newBalance`, `notes`, `cashCutId?`
(referencia al corte de origen cuando aplica), `userId`, `createdAt`.

### Estados (`CashSafeEnvelopeStatus`)

No reutilizo `CashCutStatus` (ABIERTO/CERRADO/AUDITADO) porque son
conceptos distintos — un sobre puede seguir "abierto" (con saldo)
mucho después de que su corte esté cerrado y auditado. Nombres nuevos,
sin choque:

- `PENDIENTE` — generado al cerrar el corte, aún no confirmado como recibido físicamente en la caja fuerte de la sucursal (ver §5).
- `EN_CAJA_FUERTE` — recibido, saldo == monto original. Nadie ha tocado el sobre todavía.
- `PARCIAL` — recibido, `0 < saldo < original`. Hubo al menos un retiro parcial.
- `VACIO` — saldo == 0. Se retiró todo. **No se elimina**, queda para auditoría.

### Tipos de movimiento (`CashSafeEnvelopeMovementType`)

- `INGRESO` — creación del sobre desde el corte (carga `originalAmount`).
- `RECEPCION` — confirmación de llegada física. Si `receivedAmount` capturado difiere del `originalAmount`, genera además un movimiento `AJUSTE_NEGATIVO` o `AJUSTE_POSITIVO` automático con nota `"Diferencia detectada al recibir"` — la diferencia nunca se oculta (punto 11 del pedido).
- `RETIRO` — parcial o total (un retiro que deja saldo en 0 es simplemente un `RETIRO` cuyo `newBalance` es 0; no hace falta un tipo separado).
- `AJUSTE_POSITIVO` / `AJUSTE_NEGATIVO` — corrección administrativa, motivo obligatorio, restringido por rol.

## 3. Único origen de verdad para el saldo de una sucursal

```
saldoSucursal = saldoLegado(branchId) + Σ currentBalance de sobres
                con status IN (EN_CAJA_FUERTE, PARCIAL)
```

`saldoLegado` es simplemente el `sum(DEPOSITO_SOBRE) - sum(RETIRO)` de
`CashSafeMovement` **tal como existe hoy** — no se toca, no se
convierte a sobres inventados. La clave: en cuanto el cierre de corte
deje de escribir nuevos `DEPOSITO_SOBRE` (cambio §6), ese número deja
de crecer. Se congela solo. No hace falta ninguna fecha de corte
("cutover") ni tabla nueva para marcarlo.

Los sobres `VACIO` aportan `$0` automáticamente (su `currentBalance`
ya es 0), así que no hace falta excluirlos aparte. Los `PENDIENTE` **sí**
se excluyen explícitamente: no están físicamente en la caja fuerte
todavía (ver §5), así que no deben sumar al saldo de "Caja fuerte".

Esta fórmula vive en **una sola función**,
`getBranchSafeSummary(branchId)` en `lib/cash-cuts/safeEnvelopes.ts`.
Los tres lugares que hoy recalculan el saldo por su cuenta deben
llamarla en vez de repetir la lógica (marcado como pendiente en §7 —
no lo hice porque tocar `dashboard/route.ts` no es indispensable para
que el sistema de sobres funcione, y prefiero no tocar más superficie
de la necesaria mientras el schema no exista).

## 4. Generación de código

`lib/cash-cuts/safeEnvelopes.ts::generateEnvelopeCode`

```
{Branch.code}-{YYYYMMDD del CashCut.date}-{secuencia de 3 dígitos}
```

Ej. `HUE-20260819-001`. La secuencia cuenta sobres existentes con ese
mismo prefijo (`code startsWith prefix`) + 1. Para el caso raro de dos
cierres de la misma sucursal el mismo día compitiendo por la misma
secuencia, la creación va en un `try/catch` con reintento (hasta 5
veces) sobre violación de unicidad de `code` — el candado real contra
duplicados es el `@@unique` en `cashCutId` (un corte = un sobre,
punto), el código es solo la etiqueta legible.

## 5. Pendiente de recepción → recibido

Un sobre nace `PENDIENTE` (el corte se cerró, el dinero se apartó,
pero nadie ha confirmado que ya está físicamente en la caja fuerte).
No suma al saldo de "Caja fuerte" mientras esté así — aparece en una
sección aparte, "Sobres pendientes de recibir".

`receiveEnvelope(envelopeId, receivedAmount, userId)`:
1. Verifica estado `PENDIENTE` (idempotente: si ya no lo está, no-op y devuelve el estado actual en vez de error, para tolerar doble clic).
2. Crea movimiento `RECEPCION` por `receivedAmount`.
3. Si `receivedAmount !== originalAmount`, crea además un `AJUSTE_*` con nota automática y marca el sobre para revisión (no bloquea, pero la diferencia queda registrada y visible).
4. Pasa a `EN_CAJA_FUERTE` (o `PARCIAL` si por algún motivo ya se hubiera... no aplica, un `PENDIENTE` no tiene retiros posibles todavía — la UI no ofrece retirar de un sobre pendiente).

## 6. Cambio necesario en el cierre de corte

**No toqué el archivo real** `app/api/cash-cuts/[id]/cerrar/route.ts`
porque hoy funciona en producción y depende de que el schema actual
siga como está — cambiarlo ahora lo rompería antes de que exista la
tabla nueva. Preparé el reemplazo exacto en
`cerrar-route.pending-sobres.ts`: mismo archivo, con el bloque

```ts
...(finalEnvelopeAmount && finalEnvelopeAmount > 0
  ? { safeMovements: { create: { ...DEPOSITO_SOBRE... } } }
  : {}),
```

sustituido por una llamada a `createEnvelopeForCashCut(tx, ...)`
**dentro de la misma transacción** de cierre, usando `upsert` sobre
`cashCutId` (idempotente ante reintentos, igual que ya hace el resto
de la ruta con `clientOperationId`). Este archivo se aplica en el
mismo PR que la migración — no antes.

## 7. Retiro — flujo nuevo vs. flujo legado

**Nuevo (`/api/cash-cuts/safe/envelopes/[id]/withdraw`):**
Sucursal → Sobre (con saldo disponible visible) → Cantidad → Motivo
obligatorio. Nunca permite retirar más que `currentBalance`. Un
`withdrawFull` es un caso particular: retira exactamente
`currentBalance`, con confirmación en la UI antes de ejecutar (punto 7
del pedido).

**Legado (`/api/cash-cuts/safe` POST, sin tocar):** sigue funcionando
exactamente igual, pero ahora está capado por `saldoLegado(branchId)`
en vez de por el saldo total de la sucursal — porque, en cuanto se
aplique el cambio de §6, ya no hay depósitos nuevos entrando a
`CashSafeMovement`, así que su propio cálculo interno (`deposits -
withdrawals`) coincide exactamente con `saldoLegado`. **No hace falta
tocar ese archivo tampoco.** Se apaga solo, a medida que se retira el
dinero histórico, sin inventar sobres para él. Cuando `saldoLegado`
llegue a `$0`, la UI puede ocultar esa sección (lo dejo señalado en el
componente nuevo, condicionado a `legacyBalance > 0`).

## 8. Ajustes

`adjustEnvelope(envelopeId, delta, reason, userId)` — `reason`
obligatorio en servidor (400 si falta). Restringido a `ADMIN`
únicamente (más estricto que retiro normal, que es `ADMIN`+`GERENTE`
— un ajuste corrige un error, no es una operación de rutina). Nunca
deja `currentBalance` negativo (400 si el ajuste negativo excede el
saldo).

## 9. Transaccionalidad e integridad

Todo lo que toca saldo (`receiveEnvelope`, `withdrawFromEnvelope`,
`adjustEnvelope`, `createEnvelopeForCashCut`) corre dentro de
`prisma.$transaction`, leyendo el sobre con el saldo actual **dentro**
de la transacción antes de escribir (evita condición de carrera de
doble clic: dos retiros simultáneos del mismo sobre no pueden dejarlo
en negativo, porque el segundo ve ya el saldo actualizado por el
primero al re-leer dentro de su propia transacción — Postgres serializa
los `UPDATE` sobre la misma fila). Cada función valida `amount > 0` y
`amount <= currentBalance` **dentro** de la transacción, no antes.

## 10. Qué falta para aplicar esto (cuando el schema se libere)

1. Pegar `schema-additions.prisma` en `prisma/schema.prisma` (indicado exactamente dónde).
2. `npx prisma migrate dev --name add_cash_safe_envelopes` (genera la migración real; el `migration-draft.sql` es una referencia de qué debería salir, no reemplaza el generador).
3. Reemplazar `app/api/cash-cuts/[id]/cerrar/route.ts` con `cerrar-route.pending-sobres.ts`.
4. Renombrar `app/cash-cuts/safe/page-v2-sobres.tsx` → `page.tsx` (reemplazando el actual).
5. `npx prisma generate`, `tsc --noEmit`, `eslint` — desde tu terminal (el puente a este chat no tiene DNS).
6. Probar cerrando un corte con sobre → verificar que aparece en "Pendientes de recibir" → recibirlo → retirar parcial → retirar el resto → confirmar que queda `VACIO` y no desaparece del historial.

Nada de esto se ejecutó. Es exactamente lo que pediste: diseñado, no aplicado.
