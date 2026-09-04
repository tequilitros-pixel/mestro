# MAESTRO POS 2.0 — Estado actual

Fecha de auditoría: 2026-08-30. Alcance: inspección estática del repositorio y pruebas locales seguras. No se consultó ni modificó producción.

## 1. Baseline verificable

| Elemento | Estado |
|---|---|
| Repositorio | `tequilitros-pixel/mestro` |
| Rama | `offline-sync-preview` |
| HEAD | `9006d37ee143a9e6dafb16ea91577789d545c50f` — “Agregar sobres de caja fuerte” |
| Framework | Next.js 16.3.1, App Router, React 19.2.4 |
| Lenguaje | TypeScript 5 |
| ORM / DB | Prisma 7.8.0 / PostgreSQL |
| Cliente DB | `@prisma/adapter-pg`, `pg` |
| Runtime híbrido | Capacitor 8 para Android/iOS |
| Hosting vinculado | Proyecto Vercel localmente vinculado; no se consultó ni cambió Vercel |

Variables detectadas, solo por nombre: conexiones PostgreSQL/Neon, Vercel Blob, Resend, VAPID, Anthropic y configuración pública de la app. No se imprimió ningún valor.

Había cambios previos sin commit antes de la auditoría: `.gitignore`, `components/layout/AppShell.tsx`, `components/ui/Card.tsx`, `eslint.config.mjs`, `tsconfig.json`, varios componentes de cortes, documentación de caja fuerte, archivos temporales, conciliación Prisma y `lib/inventory/eventTotals.ts`. No fueron alterados.

## 2. Arquitectura general

- Next.js App Router con Server Components, Client Components, Route Handlers y Server Actions.
- Sesión propia persistida en `UserSession`; cookie opaca hasheada en DB.
- Autorización combinada: roles globales, `ModulePermission` por usuario y `UserBranch` para sucursales.
- Prisma central en `lib/prisma.ts`; algunas lecturas/escrituras POS usan contexto RLS.
- POS en `app/pos`, UI principal en `components/pos/PosSellClient.tsx`, API en `app/api/pos`.
- Caja/cortes en `app/cash-cuts`, API en `app/api/cash-cuts`, dominio de sobres en `lib/cash-cuts/safeEnvelopes.ts`.
- Inventario general basado en `InventoryEntry` más conteos físicos periódicos.
- Cola offline en IndexedDB; ventas POS y operaciones de caja se reenvían directamente a sus APIs.

## 3. Mapa de flujos actuales

### Venta

`/pos` → `PosSellClient` → `POST /api/pos/sales` → resolución de catálogo/precios/descuentos en servidor → transacción Prisma → `PosSale` + `PosSaleItem` + `PosSalePayment` + `InventoryEntry(VENTA_POS)` + acumulación `CashSalePayment`.

La venta oficial es `PosSale`. Se considera finalizada al crearse con estado `COMPLETADA`. No hay estado de orden/borrador/apartado. Nombre, precio cobrado, precio original y beneficio se copian a la línea, por lo que cambios posteriores de catálogo no reescriben el ticket histórico.

### Cancelación

Historial/recibo → `POST /api/pos/sales/:id/cancel` → cambia `PosSale.status` a `CANCELADA` → crea `InventoryEntry(DEVOLUCION_POS)` → si el corte sigue abierto, decrementa `CashSalePayment` por método.

No hay devolución parcial, reembolso independiente, notas de crédito ni devolución por línea. Una cancelación posterior al cierre por ADMIN no corrige el corte cerrado ni crea un movimiento financiero compensatorio.

### Catálogo y precios

`/pos/categories` y `/pos/products` → Server Actions → `PosCategory` → `PosProduct` → `PosProductVariant` → `PosVariantIngredient`. El precio vive como `Float` en la variante. El precio de empleado puede vivir en la variante o derivarse del ajuste global.

Editar un producto elimina y recrea todas sus variantes e ingredientes. Las líneas históricas conservan snapshots, pero la relación `variantId` puede quedar nula por `SetNull`; también se pierde continuidad analítica de la variante.

### Descuentos, cortesías y promociones

- Descuento de venta y de línea se recalculan en servidor.
- Cortesía tiene tipo propio y motivo estructurado.
- Límites por rol viven en `PosDiscountLimit`; exceso requiere PIN de ADMIN/GERENTE.
- Precio/beneficio de empleado se audita en línea y puede tener límite mensual para botellas.
- `PosDiscountRule` soporta porcentaje o bloqueo, vigencia y sucursales. Actualmente la regla porcentual solo se ofrece como opción rápida en UI; el servidor no verifica que el porcentaje enviado corresponda a una regla configurada.
- No existe motor de promociones, combos, prioridades, exclusiones, horarios ni límites de uso.

### Caja, corte, sobre y caja fuerte

Abrir corte → `CashCut(ABIERTO)` + denominaciones y, opcionalmente, salida de inventario de evento. Venta POS acumula pagos en `CashSalePayment` por método. Entradas/salidas se guardan en `CashInflow`/`CashOutflow`. Cierre calcula:

`efectivo esperado = fondo inicial + ventas en efectivo + entradas - salidas`

Después registra contado, diferencia, fondo siguiente, totales y auditoría. El cierre toma `FOR UPDATE` sobre el corte. Si hay sobre, crea exactamente un `CashSafeEnvelope` por corte y un movimiento `INGRESO`. Recepción, retiro y ajuste usan transacciones `Serializable`, lock de fila, reintentos P2034/40001 y ledger de movimientos. Convive todavía el saldo legado `CashSafeMovement` con el nuevo ledger por sobre.

### Inventario

El diseño es principalmente **B: ledger/movimientos**, no una cantidad mutable. `InventoryEntry.quantity` suma o resta por sucursal/producto; tipos: compra, traspaso, ajuste, venta POS, devolución POS, salida/regreso de evento y producción. El stock mostrado se calcula desde el último `InventoryCount` cerrado más movimientos posteriores.

Limitaciones: el ledger no contiene actor, idempotency key ni referencia estructurada al documento origen; la venta solo se liga mediante texto en `notes`. No se valida stock disponible ni se bloquea por producto al vender. Dos terminales pueden vender simultáneamente el último artículo y producir stock negativo. Los conteos son una segunda fuente de baseline y varias acciones carecen de autorización de servidor.

## 4. Modelo de datos POS y financiero

| Modelo | Propósito y campos críticos | Constraints / índices | Riesgos |
|---|---|---|---|
| `Branch` | Sucursal global; relaciones con usuarios, ventas, cortes e inventario | `code` único; índices active/geofence | No existen Register ni Terminal; configuración POS no es por sucursal |
| `User`, `UserBranch`, `ModulePermission` | Identidad, rol, alcance y acceso por pantalla | username/email/phone únicos; user+branch y user+module únicos | Permisos son de pantalla, no capacidades; roles y asignaciones no cubren acciones finas |
| `PosCategory` | Agrupación global, orden y activo | índice position | Nombre no único; global para todas las sucursales |
| `PosProduct` | Producto comercial global | índice categoryId | Sin SKU/impuesto/precio propio; no hay disponibilidad por sucursal |
| `PosProductVariant` | Presentación vendible y precio | índice productId | Dinero en Float; sin price book, vigencia ni branch; se recrea al editar |
| `PosVariantIngredient` | Receta contra inventario | unique variante+ingrediente | Sin vigencia/versionado ni unidad explícita |
| `PosSale` | Venta oficial y snapshot agregado | code único; índices branch/cut/seller/status/date | Falta idempotency key explícita, moneda, impuestos, versionado y ledger financiero |
| `PosSaleItem` | Snapshot de línea y beneficio | índices sale/variant/discount/beneficiary | Cantidad solo Int; dinero Float; cascade desde venta permitiría borrar historia si se borra la venta |
| `PosSalePayment` | Componentes de pago mixto | índice saleId | Sin estado, referencia externa, tendered/change, refund ni constraint de unicidad |
| `PosDiscountLimit` | Límite por rol | role único | Ausencia significa sin límite; default fail-open |
| `PosDiscountRule` | Regla global/por ramas, vigencia | índices active/mode y fechas | No se enlaza a una venta ni se valida su uso en servidor |
| `PosSettings` | Ajustes globales de empleado | id fija | No versionado ni por sucursal |
| `CashCut` | Sesión/corte de caja agregado | code único; índices branch/responsible/status/date | Mezcla sesión, declaración, cierre y métricas; no identifica register/terminal; dinero Float |
| `CashSalePayment` | Totales mutables del corte por método | unique cut+method | Es proyección mutable, no ledger; también permite captura manual |
| `CashInflow` / `CashOutflow` | Entradas y salidas del turno | índices por corte | Sin idempotency key; inflow no guarda actor; dinero Float |
| `CashCutAuditEntry` | Cambios del corte | índices cut/user | Campos string no estructurados; cascada permite pérdida si se elimina el corte |
| `CashSafeEnvelope` | Sobre identificable de un corte | code y cashCutId únicos | Buen encabezado/proyección; dinero Float |
| `CashSafeEnvelopeMovement` | Ledger de sobre | índices envelope/cut/type | Fuerte diseño de concurrencia, pero inmutabilidad depende del código, no DB |
| `CashSafeMovement` | Ledger legado por sucursal | índices branch/cut | Convive con sobres y obliga a sumar dos fuentes |
| `InventoryProduct` | Catálogo físico y unidades | code único; varios índices | Catálogo físico separado del comercial; unidad legacy string convive con enums |
| `InventoryEntry` | Movimiento de inventario | índices branch/product/date | Sin FK a venta/transferencia, actor, unique/idempotencia ni índice compuesto branch+product+date |
| `InventoryCount` / `InventoryCountItem` | Conteo físico/baseline | code único; count+product único | Cierre concurrente y edición no protegidos; baseline puede ocultar discrepancias |

Conceptos ausentes o mezclados:

- `Order`: ausente; carrito solo vive en memoria del navegador.
- `Sale`: existe y es el documento oficial.
- `Payment`: existe como fila simple, sin ciclo de vida.
- `Refund`: ausente; cancelación no es reembolso contable.
- `CashMovement`: fragmentado entre inflows, outflows, pagos agregados, safe legacy y envelope ledger.
- `CashSession` y `CashCut`: mezclados en `CashCut`.
- `InventoryMovement`: `InventoryEntry` cumple parcialmente esta función.
- `Discount`: snapshots existen; no hay entidad de aplicación/reversión.
- `Promotion`: ausente; `PosDiscountRule` es insuficiente.
- `Price`: embebido en variante; no existe como entidad versionada.
- `Register` y `Terminal`: ausentes.

## 5. Concurrencia e idempotencia

| Operación | Clasificación | Evidencia |
|---|---|---|
| Crear venta online | PARTIALLY SAFE | Transacción atómica y botón bloqueado; petición online inicial no envía `clientOperationId`, por lo que retry externo puede duplicar |
| Sincronizar venta offline | PARTIALLY SAFE | UUID se usa como ID de venta; unique PK recupera duplicado, pero pre-check y create no capturan conflicto concurrente con respuesta idempotente |
| Descontar inventario de venta | PARTIALLY SAFE | Misma transacción que venta; no hay control de disponibilidad/lock/optimistic version |
| Acumular pago al corte | PARTIALLY SAFE | Misma transacción y upsert; correcto si la venta no se duplica |
| Cancelar venta | **UNSAFE** | Lectura de estado fuera de tx y update no condicional: dos cancelaciones pueden duplicar reversión y decremento |
| Abrir corte | PARTIALLY SAFE | Soporta ID offline, pero no se observó constraint que garantice un solo corte abierto por sucursal/register |
| Cerrar corte | SAFE | Lock `FOR UPDATE`, una tx y sobre unique por corte; retry devuelve duplicado con ID cliente |
| Entradas/salidas/manual sales de corte | PARTIALLY SAFE | Offline IDs ayudan; estado se valida antes de escritura y no siempre bajo lock |
| Recibir sobre | SAFE | Serializable + row lock + estado idempotente + retry |
| Retirar/ajustar sobre | SAFE ante concurrencia | Serializable + row lock + retry; un nuevo request legítimo vuelve a aplicar por diseño y no tiene operation ID |
| Traspaso inventario | PARTIALLY SAFE | Dos movimientos en una tx; no reserva/valida stock ni posee idempotency key |
| Conteo inventario | UNSAFE | Varias acciones no autentican/autorizan y estado puede cambiar concurrentemente |

## 6. Seguridad, roles y multi-sucursal

Roles: `ADMIN`, `GERENTE`, `ENCARGADO`, `OPERATOR`, `CONSULTA`. Vender y cancelar: ADMIN/GERENTE/ENCARGADO. Autorizar descuentos altos: ADMIN/GERENTE. Catálogo/ajustes POS: UI ADMIN. Caja fuerte: retiro ADMIN/GERENTE, recepción también ENCARGADO, ajustes ADMIN.

Fortalezas:

- La mayoría de APIs financieras autentican, validan rol y alcance de sucursal.
- `PosSale`, items y pagos tienen políticas RLS; rutas de venta establecen contexto.
- Las lecturas de ventas y reportes filtran por sucursales accesibles.
- Caja fuerte valida branch y aplica lógica de dominio centralizada.

Hallazgos críticos:

1. `app/pos/products/actions.ts`: crear, editar, activar/desactivar producto o variante no llama `requireAdmin`; solo eliminar lo hace.
2. `app/pos/categories/actions.ts`: ninguna acción autentica ni autoriza en servidor.
3. `app/administration/inventory/branch-counts/actions.ts`: crear, editar y cerrar conteos no autentican, no validan permiso ni branch.
4. `createInventoryEntryAction` exige sesión y branch, pero no capacidad específica para ajustar inventario; cualquier usuario con branch podría invocarla.
5. La protección por layout y navegación no sustituye autorización de cada Server Action.
6. RLS cubre ventas, no todo el dominio de caja/inventario; el aislamiento depende del código de cada endpoint.
7. No existe entidad Terminal/Register ni credencial/dispositivo asociado: no se puede atribuir una operación al hardware lógico.

## 7. Configurabilidad

| Aspecto | Clasificación actual | Nota |
|---|---|---|
| Productos/categorías/variantes/precios/recetas POS | CONFIGURABLE DESDE APP | Globales; faltan precios/disponibilidad por sucursal |
| Imágenes | MIXTO | Upload/URL e iconografía; visuales por defecto dependen de código |
| Inventario/ajustes/traspasos/conteos | CONFIGURABLE DESDE APP | Permisos de servidor insuficientes |
| Descuentos/cortesías | MIXTO | Importes/motivos en app; lista de motivos hardcoded en enum/UI |
| Promociones/combos | HARDCODED / AUSENTE | Solo reglas porcentuales o bloqueo |
| Impuestos | AUSENTE | Sin configuración ni snapshots |
| Métodos de pago | HARDCODED | Enum Prisma y arreglo UI |
| Sucursales | CONFIGURABLE DESDE APP | Administración existente; alcance asignable |
| Cajas/terminales | AUSENTE | Corte equivale parcialmente a caja/turno |
| Roles | HARDCODED | Enum y checks dispersos |
| Permisos | MIXTO | Módulos asignables; capacidades y catálogo de permisos hardcoded |
| Horarios | CONFIGURABLE DESDE APP | En módulo de personal, no reglas POS/promociones |
| Motivos de cancelación | HARDCODED / LIBRE | Texto libre, no catálogo administrable ni obligatorio |
| Motivos de merma | AUSENTE | Ajuste genérico y notas |
| Límites POS | CONFIGURABLE DESDE APP | Descuento y botellas de empleado, globales |
| Configuración POS | MIXTO | Dos settings globales; mayoría de reglas en código |

## 8. UX real del cajero

Estimación desde el flujo implementado:

- Iniciar sesión: 2–3 acciones (credenciales y enviar; SMS alternativo).
- Abrir caja: navegar, elegir sucursal, capturar fecha/fondo/denominaciones y confirmar: aproximadamente 8–15 acciones.
- Agregar producto de variante única: 1 toque; con variantes: 2.
- Cambiar cantidad: 1 toque por incremento/decremento.
- Varios productos: 1–2 toques por línea.
- Descuento total: abrir modal, elegir regla/importe, motivo y aplicar: 3–6.
- Descuento/cortesía por línea: menú de línea, tipo, valor, motivo, aplicar: 4–7.
- Cobrar efectivo: cobrar + confirmar: 2; cambiar importe: 3.
- Tarjeta/transferencia: cobrar, selector, confirmar: 3.
- Pago mixto: cobrar, agregar fila, elegir método y montos, confirmar: 5–8.
- Siguiente venta: el carrito se limpia tras éxito: 0–1.
- Quitar producto: 1; reducir cantidad: 1 por unidad.
- Cancelar venta: salir a historial, abrir/acción, motivo y confirmar: aproximadamente 4–6.

Fortalezas: cuadrícula touch, botones de cantidad, catálogo cacheado, carrito visible, pago mixto, bloqueo durante submit, resumen claro. Fricciones: modales anidados para variantes/descuentos/pago; no hay búsqueda de catálogo visible; carrito solo en memoria; branch se elige en cada contexto; no hay cambio calculado para efectivo, lector/barcode, favoritos, teclado físico ni modo terminal; al encolar offline se limpia inmediatamente el carrito sin comprobante definitivo y una venta puede fallar después.

## 9. Performance y observabilidad

Riesgos de hora pico:

- Catálogo completo se descarga de una vez y se guarda entero en localStorage; no hay búsqueda/indexado ni paginación.
- Venta crea cada movimiento de ingrediente y actualiza cada método secuencialmente dentro de la transacción; con 20 líneas/recetas amplía locks y latencia.
- Código de venta sin operation ID usa `count` diario y puede colisionar concurrentemente.
- `computeStockMatrix` ejecuta dos queries por sucursal (patrón N+1 por branch).
- Reportes cargan hasta 200 ventas con items/pagos y analytics vuelve a consultar conjuntos amplios.
- Uso general de `Float` exige tolerancias y puede acumular error financiero.
- Índices simples existen, pero faltan compuestos frecuentes como inventario `(branchId, productId, entryDate)` y venta `(branchId, createdAt, status)`.

Observabilidad actual: `console.error`, respuestas JSON y bitácora parcial de cortes/sobres. No se observó correlación request/operation ID universal, logging estructurado, métricas, tracing, alertas de venta fallida, dead-letter operacional de offline, conciliación automática ni historial auditable de cambios de catálogo/precio/configuración. Investigar un incidente días después depende de DB, notas libres y logs efímeros.

## 10. Clasificación funcional final

| Área | Decisión | Justificación |
|---|---|---|
| Catálogo CRUD | IMPROVE | Base útil y administrable; asegurar acciones, versionar y añadir alcance branch |
| Carrito/UI de venta | REFACTOR | Buen baseline touch, pero necesita estado durable, búsqueda y flujo terminal |
| Snapshot de líneas | KEEP | Protege historia de nombre/precio/beneficio |
| Venta transaccional | IMPROVE | Atomicidad buena; falta idempotencia obligatoria y ledger financiero |
| Pagos mixtos | KEEP + IMPROVE | Modelo soporta múltiples filas; falta ciclo de vida/referencias/cambio |
| Cancelación | REPLACE | Carrera crítica y semántica insuficiente para refund/reversal |
| Descuentos/cortesías | REFACTOR | Buena distinción y auditoría parcial; requiere motor y aplicaciones versionadas |
| Promociones | NEW | No existe motor real |
| Inventario por movimientos | KEEP + IMPROVE | Dirección correcta; añadir referencias, actor, idempotencia y control concurrente |
| Conteos como baseline | REFACTOR | Útiles operativamente; deben emitir correcciones y no redefinir historia silenciosamente |
| Corte actual | REFACTOR | Conservar operación, separar CashSession/CashDeclaration/CashLedger |
| Ledger de sobres | KEEP | Es el componente más sólido: inmutable, locked, serializable e idempotente |
| CashSafeMovement legado | REMOVE gradual | Mantener solo durante reconciliación/cutover |
| Roles/permisos | REPLACE | Pasar de pantallas/roles dispersos a capacidades en servidor |
| Branch isolation | IMPROVE | Cobertura buena en rutas principales, no uniforme ni DB-wide |
| Register/Terminal | NEW | Necesarios para retail multi-terminal |
| Offline | REFACTOR | Cola prometedora, todavía no apta para garantía financiera completa |
| Auditoría/observabilidad | NEW/IMPROVE | Unificar actor, terminal, motivo, request y correlación |
