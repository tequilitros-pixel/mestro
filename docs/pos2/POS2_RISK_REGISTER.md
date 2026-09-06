# MAESTRO POS 2.0 — Registro de riesgos

Escala: impacto/probabilidad Alta, Media o Baja. P0 requiere contención antes del piloto.

| ID | Riesgo | Tipo | Prob. | Impacto | Prioridad | Mitigación propuesta |
|---|---|---|---|---|---|---|
| R01 | Doble cancelación revierte inventario/caja dos veces | Financiero/datos | Media | Alta | **P0** | Update condicional/lock + unique reversal operation |
| R02 | Server Actions de catálogo sin autorización propia | Seguridad | Media | Alta | **P0** | Policy server-side deny-by-default y tests directos |
| R03 | Acciones de conteo sin auth/branch scope | Seguridad/datos | Media | Alta | **P0** | Capacidad inventory.count + scope y CAS |
| R04 | Venta online inicial sin operationId | Financiero | Media | Alta | **P0** | Generarlo antes del primer submit y unique receipt |
| R05 | Oversell/stock negativo entre terminales | Operativo/datos | Alta | Alta | **P0** | Política aprobada, lock/CAS de balance |
| R06 | Cancelación post-cierre no reconcilia corte | Financiero | Media | Alta | **P0** | Return/refund/reversal posterior, no mutar corte |
| R07 | Dinero en Float | Financiero | Media | Alta acumulada | P0 | Decimal/minor units y reconciliación de migración |
| R08 | CashCut mezcla sesión, corte y agregados mutables | Arquitectura | Alta | Alta | P1 | Separar CashSession/Declaration/Ledger |
| R09 | No existen Register/Terminal | Auditoría/operación | Alta | Media/Alta | P1 | Enrollment y atribución obligatoria |
| R10 | Inventario sin source FK/actor/idempotencia | Datos/auditoría | Alta | Alta | P0 | Ledger nuevo append-only |
| R11 | Precio global no versionado ni por branch | Financiero/operativo | Alta | Alta | P1 | Price lists versionadas |
| R12 | Regla promocional ofrecida por UI pero no vinculada/verificada | Financiero | Media | Media | P1 | Quote firmado/versionado y application record |
| R13 | Ausencia de Refund/Return | Financiero/cliente | Alta | Alta | P0 | Modelos y workflow compensatorio |
| R14 | RLS solo parcial | Seguridad | Media | Alta | P0 | Inventario de tablas sensibles y políticas DB |
| R15 | Permisos de pantalla en vez de capacidades | Seguridad | Alta | Alta | P0 | Authorization service central |
| R16 | Cola offline limpia carrito antes de aceptación | Operativo/financiero | Media | Alta | P1 | Ticket pending y centro de excepciones |
| R17 | Cola FIFO global bloqueada por un fallo permanente | Disponibilidad | Media | Media | P1 | Dependencias por aggregate/dead letter |
| R18 | Cambio de receta elimina continuidad de variante | Datos/reporting | Alta | Media | P1 | Versionar receta/variante, no delete/recreate |
| R19 | Código secuencial por count puede colisionar | Operativo | Media | Media | P1 | Secuencia DB/serie por register |
| R20 | Un solo corte abierto no garantizado por constraint | Financiero | Media | Alta | P0 | Unique parcial por register/status |
| R21 | N+1 por sucursal en stock | Performance | Alta | Media | P1 | Query agregada/proyección |
| R22 | Writes secuenciales por ingrediente/pago | Performance | Alta | Media | P1 | createMany/batching y medición |
| R23 | Logs no estructurados/no correlacionados | Operativo | Alta | Alta | P0 | operationId, métricas y alertas |
| R24 | Dos fuentes de caja fuerte (legacy + sobres) | Migración/finanzas | Media | Alta | P1 | Baseline firmado, cutover y reconciliación |
| R25 | Cascades permiten borrar evidencia histórica | Cumplimiento | Baja/Media | Alta | P0 | Restrict/soft lifecycle/DB role sin delete |
| R26 | Valores/motivos/métodos hardcoded requieren deploy | Operativo | Alta | Media | P1 | Definiciones versionadas desde app |
| R27 | Configuración excesiva compromete invariantes | Arquitectura | Media | Alta | P0 | Lista explícita de reglas no configurables |
| R28 | Dual-write no atómico durante migración | Migración | Media | Alta | P0 | Misma tx/outbox + reconciliación |
| R29 | Rollback duplica operaciones pendientes | Migración | Media | Alta | P0 | OperationReceipt común a V1/V2 |
| R30 | Acceso cross-branch por endpoint futuro omitido | Seguridad | Media | Alta | P0 | Scope obligatorio, RLS y suite negativa |

## Riesgos más urgentes

Antes de cualquier implementación POS 2.0 deben contenerse R01–R07, R10, R13–R15 y R20. El ledger de sobres puede conservarse como patrón positivo. Ningún riesgo aquí fue corregido durante esta fase por instrucción expresa de solo auditoría/diseño.
