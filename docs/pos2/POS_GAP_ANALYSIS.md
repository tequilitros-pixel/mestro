# MAESTRO POS 2.0 — Gap analysis

| Dominio | CURRENT | TARGET | GAP | Prioridad | Riesgo | Recomendación |
|---|---|---|---|---|---|---|
| Catálogo | Global, administrable, variante/receta | Catálogo versionado y publicable por sucursal/canal | Sin SKU, disponibilidad branch ni vigencias | P1 | Operativo | Conservar entidades y añadir publicación/versiones |
| Precios | Float en variante | Price books Decimal, vigencia y branch | Precio no versionado ni programable | P0 | Financiero | Snapshot + `PriceList/PriceEntry` |
| Promociones | % rápido o bloqueo | Motor determinista con prioridad/exclusión | No hay combos/horarios/límites/aplicaciones | P1 | Financiero | Reglas declarativas, versiones inmutables |
| Ventas | `PosSale` creada directamente completa | Order → priced order → finalized Sale | Sin draft, número estable ni state machine | P0 | Financiero | Idempotencia obligatoria y estados explícitos |
| Pagos | Filas simples, pago mixto | Payment/Attempt/Tender/Refund con referencias | Sin estado, adquirente, cambio o refund | P0 | Financiero | Ledger y adaptadores por método |
| Caja | Corte agrega pagos mutables | CashSession + ledger + declaración/corte | Sesión y corte mezclados; no hay register | P0 | Financiero | Separar hechos, proyecciones y cierre |
| Inventario | Ledger parcial + conteo baseline | Ledger referenciado, unidad normalizada, reservas/política stock | Sin actor/origen FK/idempotencia/lock | P0 | Datos | Movimiento inmutable y proyección de saldo |
| Sucursales | `Branch` y UserBranch | Tenant/branch boundaries uniformes | Catálogo/settings globales; checks dispersos | P0 | Seguridad | Servicio de scope + RLS en tablas sensibles |
| Terminales | Ausentes | Branch → Register → Terminal → Session | Sin atribución/dispositivo | P1 | Auditoría | Registrar terminal logical ID y enrollment |
| Seguridad | Roles + permisos de pantalla | Capacidades granulares server-side | Server Actions sin auth; fail-open | **P0** | Crítico | Middleware de políticas y pruebas negativas |
| Auditoría | Corte/sobre parcial y snapshots | AuditEvent append-only transversal | Sin cambios catálogo/precio/config | P0 | Cumplimiento | Outbox/audit en misma tx |
| Devoluciones | Solo cancelación total | Return + Refund + Inventory reversal | No parcial ni post-cierre reconciliable | P0 | Financiero | Documentos compensatorios, nunca edición |
| Concurrencia | Tx en venta; locks solo cierre/sobre | Idempotencia/locking/versionado por operación | Doble cancelación y oversell | **P0** | Crítico | Unique operation key, CAS, locks necesarios |
| Offline | Cola IndexedDB y UUID para sync | Store-and-forward verificable | Online no usa ID; fallo tardío limpia carrito | P1 | Financiero | Operation envelope y estados pending/accepted/rejected |
| Reportes | Queries de ventas y agregados de corte | Proyecciones reconciliables | Sin ledger único ni snapshots completos | P1 | Decisión | Read models derivados, conciliación diaria |
| Configuración | Catálogo y algunos límites en app | Config versionada por scope y vigencia | Métodos, motivos, capacidades hardcoded | P1 | Operativo | Registry tipado con validación y audit |
| UX | Touch usable, modales y branch selector | Flujo de caja de alta velocidad | Sin búsqueda/barcode/cambio/draft | P2 | Productividad | Diseñar tras estabilizar invariantes |
| Performance | Catálogo completo, queries secuenciales/N+1 | P95 predecible en hora pico | Índices y batch writes insuficientes | P1 | Disponibilidad | Batch create, índices compuestos, medición |
| Observabilidad | Console + auditoría localizada | Logs/métricas/traces con correlation ID | Incidentes difíciles de reconstruir | P0 | Operativo | Event IDs y panel de excepciones |

## Decisiones que requieren aprobación

1. Política de stock: bloquear venta bajo cero, permitir con permiso o permitir por producto.
2. Momento fiscal/oficial: autorización de pago versus confirmación/captura.
3. Política de cancelación: ventana, roles y diferencia entre void, return y refund.
4. Alcance de catálogo/precios: global con overrides o catálogo completamente por sucursal.
5. Métodos de pago iniciales y cuáles requieren referencia/conciliación externa.
6. Modelo de terminal: dispositivo enrolado, sesión por caja y tolerancia offline.
7. Precisión/unidad base de inventario y reglas de redondeo.
8. Estrategia de coexistencia del legado de caja fuerte y fecha de cutover.
