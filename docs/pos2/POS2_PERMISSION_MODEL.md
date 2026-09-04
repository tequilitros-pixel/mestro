# POS 2.0 — Modelo de permisos

## Contrato

Permiso = `capability + scope + constraints`. Scopes: `SELF`, `BRANCH`, `MULTI_BRANCH`, `GLOBAL`. SELF aplica a orders/sesiones propias, nunca permite inventar branch. MULTI_BRANCH se resuelve contra asignaciones explícitas. GLOBAL queda reservado a administración empresarial.

| Capability | Scope normal | Restricciones/aprobación |
|---|---|---|
| pos.order.create/edit | SELF/BRANCH | sesión y terminal válidos |
| pos.sale.create | BRANCH | cash session OPEN |
| pos.price.override | BRANCH | límite por monto/%; siempre audit |
| pos.discount.apply | BRANCH | límite configurado por grant |
| pos.courtesy.apply | BRANCH | razón y posible aprobación superior |
| pos.sale.cancel | BRANCH | ventana/monto; supervisor si excede |
| pos.return.create | BRANCH | cantidad/disposición |
| pos.refund.create | BRANCH | monto/método; separación de funciones opcional |
| cash.session.open | BRANCH | register asignado |
| cash.session.close | SELF/BRANCH | encargado puede cerrar propia; gerente branch |
| cash.movement.inflow/outflow | BRANCH | razón; límites |
| cash.adjust | BRANCH/GLOBAL | alta sensibilidad, aprobación |
| safe.envelope.receive | BRANCH | conserva roles actuales equivalentes |
| safe.withdraw | BRANCH | gerente/admin equivalente |
| safe.adjust | GLOBAL o branch con approval | admin equivalente |
| inventory.view | BRANCH/MULTI_BRANCH | — |
| inventory.transfer | MULTI_BRANCH | requiere acceso a origen y destino |
| inventory.adjust | BRANCH | razón/límite |
| inventory.count | BRANCH | create/update/close separables si hace falta |
| catalog.edit/publish | GLOBAL | catálogo empresarial |
| pricing.edit | GLOBAL/MULTI_BRANCH | draft |
| pricing.publish | GLOBAL/MULTI_BRANCH | separar de edit cuando sea necesario |
| promotion.manage | GLOBAL/MULTI_BRANCH | — |
| branch.manage | GLOBAL | — |
| register.manage/terminal.enroll | BRANCH/GLOBAL | enrollment auditable |
| reports.operational.view | BRANCH/MULTI_BRANCH | — |
| reports.financial.view | BRANCH/MULTI_BRANCH/GLOBAL | sensible |
| users.manage/permissions.manage | GLOBAL | alta sensibilidad |

## Evaluación server-side

`authorize(actor, capability, resourceScope, context)` devuelve allow/deny y `grantId/constraints`. Se ejecuta dentro del command antes de cualquier dato sensible y se revalida bajo tx si el recurso/scope puede cambiar. La UI puede preguntar `can()` únicamente para presentación.

Defaults: deny. Ausencia de fila nunca significa “sin límite”. Constraints tipados: maxDiscountPercent, maxAmount, ownSessionOnly, requireApprovalAbove, allowedMethods.

## Convivencia con roles actuales

1. Crear plantillas de grants que reproduzcan ADMIN/GERENTE/ENCARGADO/OPERATOR/CONSULTA.
2. Backfill asignaciones por `User.role`, `UserBranch` y `ModulePermission` sin retirar los checks legacy.
3. Shadow-evaluar legacy versus capability y reportar divergencias.
4. En endpoints V2 capability es autoritativa; V1 mantiene su lógica hasta ser migrado.
5. Corregir primero las Server Actions V1 inseguras con checks explícitos existentes; no esperar al motor nuevo.
6. Tras rollout, roles se convierten en bundles administrables; grants excepcionales quedan auditados y con vigencia.

## Approval

Una aprobación no comparte PIN sin contexto. `ApprovalGrant` efímero se emite tras reautenticación, ligado a actor solicitante, command draft/hash, capability, límites y expiración corta; se consume una vez dentro de la misma operación. Registra aprobador y evita que un PIN capturado autorice otra venta.
