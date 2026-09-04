# POS 2.0 — Arquitectura de caja Fase 3B

Fecha: 2026-08-30.

## Separación de identidades

- **Branch**: sucursal organizacional y límite de acceso.
- **Register**: caja lógica/financiera configurable dentro de una Branch. No representa hardware.
- **Terminal**: dispositivo autorizado de una Branch. No pertenece permanentemente a un Register; la asociación queda en cada CashSession.
- **CashSession**: periodo durante el cual un usuario opera un Register, abierto/cerrado desde terminales verificadas.
- **CashMovement**: ledger V2 inmutable que explica el efectivo esperado.
- **CashDeclaration**: importe contado y declarado por una persona; cada recuento agrega historia.
- **CashCut**: proyección legacy creada al cerrar, necesaria para reportes y caja fuerte.
- **CashSafeEnvelope**: sigue ligado uno-a-uno a CashCut; no fue sustituido.

## Register

`Register(branchId, code, name, active)` usa `unique(branchId, code)`. Se desactiva con `active=false`; no existe operación destructiva. La pantalla `/administration/pos2/cash` permite crearlo, editar su estado y listar sesiones sin deployment ni hardcode.

## Terminal y enrolamiento

Una Terminal nace `DISABLED`. Un administrador con `terminal.manage` crea un `TerminalEnrollment` y recibe un token aleatorio de 256 bits que se muestra una sola vez. En base solo se guarda SHA-256 del token, su expiración, uso y revocación.

El dispositivo intercambia token + `deviceIdentifier` en `/api/pos2/terminals/enroll`. Bajo lock de fila se valida que el token exista, no esté usado/revocado/expirado y que la Terminal no esté revocada. Se emite una credencial aleatoria persistente, se guarda únicamente su hash y la Terminal pasa a `ACTIVE`. Reusar el token falla.

Las requests financieras requieren sesión de usuario y headers:

- `x-maestro-terminal-id`
- `x-maestro-terminal-credential`

La credencial se compara en tiempo constante. `REVOKED` elimina su hash, revoca tokens pendientes e impide nuevas operaciones. Re-enrollment futuro se implementa emitiendo un nuevo enrollment explícito; nunca se acepta un UUID inventado por localStorage como identidad confiable.

## CashSession

State machine:

```text
OPEN ──► CLOSING ──► CLOSED
  └───────────────► CANCELLED
          CLOSING ─► OPEN     (recuperación futura explícita)
          CLOSING ─► CANCELLED
```

`CLOSED` y `CANCELLED` son terminales. En el comando actual, `CLOSING` y `CLOSED` se escriben dentro de una sola transacción; ningún observador ve un cierre parcial.

El índice parcial PostgreSQL `CashSession_one_active_per_register` es único por `registerId` para estados `OPEN|CLOSING`. Dos aperturas simultáneas no pueden dejar dos sesiones activas aunque ambas pasen checks de aplicación.

## Ledger y efectivo esperado

CashMovement usa Decimal(18,2), importe positivo —cero solo para `OPENING_FLOAT`— y dirección explícita `IN|OUT`. Tipos preparados:

- `OPENING_FLOAT`
- `SALE_CASH`
- `CASH_IN`
- `CASH_OUT`
- `REFUND_CASH`
- `ADJUSTMENT`
- `SAFE_TRANSFER`

Fórmula oficial:

```text
expectedCash = Σ movimientos IN − Σ movimientos OUT
difference   = declaredCash − expectedCash
```

Por tanto, diferencia positiva es sobrante y negativa es faltante. El cierre guarda `expectedCash` y `difference` como snapshot consultable, pero el ledger es la explicación y fuente primaria. Nunca se agrega un ajuste automático para ocultar una diferencia.

`CashMovement` tiene trigger que rechaza UPDATE/DELETE. Toda corrección financiera futura debe ser un movimiento compensatorio.

## Declaraciones y recuentos

Al abrir se crean una declaración `OPENING` y un movimiento `OPENING_FLOAT`. Al cerrar se crea `CLOSING`. Un recuento crea `RECOUNT` con `supersedesId`, actor, terminal, razón y timestamp; la declaración anterior no cambia. Otro trigger rechaza UPDATE/DELETE de cualquier declaración.

El recuento recalcula `difference` contra el mismo expected del cierre y actualiza CashCut únicamente como proyección legacy visible.

## Locking e idempotencia

Open, Close, CashIn, CashOut y Recount usan OperationReceipt con UUIDv7 y hash canónico de payload. El mismo operationId/payload reproduce el resultado; payload distinto devuelve `IDEMPOTENCY_KEY_REUSED`.

Toda mutación de una sesión existente ejecuta `SELECT ... FOR UPDATE` sobre CashSession antes de validar estado o escribir. Consecuencias:

- dos cierres producen un solo cierre efectivo;
- CashOut y Close se serializan;
- si CashOut gana el lock, el cierre lo incluye en expected;
- si Close gana, CashOut obtiene la sesión CLOSED y falla;
- ningún movimiento se inserta entre el cálculo de expected y el commit.

No hay locks globales ni locks de múltiples sesiones.

## Permisos

Las operaciones nuevas V2 usan enforcement real, no shadow:

- `cash.session.open`
- `cash.session.close`
- `cash.declaration.create`
- `cash.recount`
- `cash.in.create`
- `cash.out.create`
- `cash.adjust`
- `register.manage`
- `terminal.manage`

La migración agrega las seis capacidades que faltaban y grants GLOBAL para rol ADMIN. Otros roles requieren grants explícitos y además respetan su lista de Branch. Los flujos legacy conservan sus permisos actuales/shadow; Fase 3B no los reemplaza.

## Bridge CashCut y sobres

CashSession/ledger/declaraciones son la fuente de verdad V2. Al cerrar, la misma transacción crea exactamente un CashCut `CERRADO` y enlaza `CashSession.cashCutId @unique`. El CashCut copia los importes necesarios para compatibilidad: fondo, esperado, contado, diferencia, entradas, salidas, ventas cash, fondo siguiente y sobre.

Si `envelopeAmount > 0`, esa misma transacción usa `createEnvelopeForCashCut`. Se conserva el backbone existente:

```text
CashSession V2 ──proyecta──► CashCut legacy ──1:1──► CashSafeEnvelope
```

CashCut no alimenta de vuelta el ledger V2. Los endpoints legacy no crean CashSession y los commands V2 no llaman al endpoint legacy de cierre, evitando dos cortes para una misma sesión. Los Float legacy solo reciben conversiones explícitas desde Money en el bridge; los modelos nuevos usan Decimal.

## API y administración

La lógica vive en `lib/pos2/cash/*`, no en Route Handlers. Contratos disponibles:

- `POST /api/pos2/cash-sessions`
- `POST /api/pos2/cash-sessions/:id/movements`
- `POST /api/pos2/cash-sessions/:id/close`
- `POST /api/pos2/cash-sessions/:id/recount`
- `POST /api/pos2/terminals/enroll`

La administración mínima vive en `/administration/pos2/cash` y requiere ADMIN.
