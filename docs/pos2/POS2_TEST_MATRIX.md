# MAESTRO POS 2.0 — Matriz de pruebas

| ID | Tipo | Escenario | Verificación principal |
|---|---|---|---|
| S01 | UNIT | Precio base/branch/programado | Selección determinista y snapshot |
| S02 | UNIT | Prioridad/exclusión/stacking promoción | Una explicación reproducible |
| S03 | UNIT | Redondeo, descuentos y cortesía | Totales exactos Decimal |
| S04 | INTEGRATION | Venta normal | Sale, payment, ledgers, audit en una tx |
| S05 | INTEGRATION | Venta con 20 productos/recetas | Cantidades y performance dentro SLO |
| S06 | INTEGRATION | Descuento total y por línea | Autorización y aplicaciones guardadas |
| S07 | SECURITY | Cortesía sin capacidad / sobre límite | Denegada en servidor |
| S08 | INTEGRATION | Efectivo | Tender, recibido, cambio y caja correctos |
| S09 | INTEGRATION | Tarjeta | Intento/ref externa/estado correcto |
| S10 | INTEGRATION | Transferencia | Referencia y conciliación requeridas |
| S11 | INTEGRATION | Pago mixto | Suma exacta y múltiples payments |
| S12 | INTEGRATION | Venta $0 autorizada | Sin payment; beneficio íntegro |
| S13 | CONCURRENCY | Doble submit mismo operationId | Una sola venta; misma respuesta |
| S14 | CONCURRENCY | Dos operationId para misma orden | Solo una finalización |
| S15 | E2E | Refresh durante carrito | Order durable se recupera |
| S16 | E2E | Refresh tras cobro/respuesta perdida | Consulta receipt; no duplica |
| S17 | OPERATIONAL | Pérdida de conexión antes/durante/después | Estado pending/accepted inequívoco |
| S18 | OPERATIONAL | Retry tras timeout | Resultado idempotente |
| S19 | CONCURRENCY | Dos cajas simultáneas | Totales y sesiones aislados |
| S20 | CONCURRENCY | Último producto disponible | Política stock aplicada atómicamente |
| S21 | INTEGRATION | Cancelación antes de cierre | Reversals únicos y auditables |
| S22 | CONCURRENCY | Doble cancelación | Un solo reversal |
| S23 | INTEGRATION | Devolución parcial | ReturnLine/refund/inventory ligados |
| S24 | INTEGRATION | Refund a método original | Ledger balanceado y estado payment |
| S25 | INTEGRATION | Cancelación/devolución post-cierre | Corte histórico intacto; ajuste posterior explicado |
| S26 | INTEGRATION | Cierre de caja | Esperado, contado, diferencia y declaración |
| S27 | CONCURRENCY | Doble cierre | Un cierre/un sobre |
| S28 | INTEGRATION | Diferencia de caja | Motivo, actor y workflow de revisión |
| S29 | INTEGRATION | Recepción de sobre con diferencia | Reception + adjustment exactos |
| S30 | CONCURRENCY | Dos retiros simultáneos | Sin saldo negativo/doble retiro |
| S31 | INTEGRATION | Cambio de precio con orden abierta | Política de reprice/version explícita |
| S32 | SECURITY | Usuario sin vender/descontar/cancelar/refund | 403 y ningún write |
| S33 | SECURITY | ID de venta/corte/producto de otra sucursal | 404/403 uniforme y ningún leak |
| S34 | SECURITY | Invocar Server Action sin abrir UI | Capacidad validada en servidor |
| S35 | SECURITY | Manipular branchId/payment total/precio | Servidor recalcula y rechaza |
| S36 | INTEGRATION | Traspaso | Dos movimientos atómicos con transferId |
| S37 | CONCURRENCY | Conteo y venta concurrentes | Cutoff y corrección deterministas |
| S38 | INTEGRATION | Merma/ajuste/conteo | Actor, motivo, unidad y source completos |
| S39 | E2E | Flujo siguiente venta | Carrito limpio solo tras receipt aceptado |
| S40 | E2E | Touch tablet y teclado/barcode | Targets, foco y latencia aceptables |
| S41 | OPERATIONAL | Cola con operación inválida | No bloquea operaciones independientes; needs_review |
| S42 | OPERATIONAL | Sesión expira con cola | Reautenticación y ownership seguro |
| S43 | PERFORMANCE | Catálogo grande | carga incremental y búsqueda dentro SLO |
| S44 | PERFORMANCE | Hora pico multi-terminal | P95/P99, locks y pool dentro SLO |
| S45 | INTEGRATION | Reconciliación diaria | venta=pagos/refunds, caja y stock sin diferencia |
| S46 | SECURITY | RLS directo en tablas sensibles | Sin contexto no expone/escribe filas |

## Pruebas de caracterización inmediatas para V1

Antes de refactorizar: congelar mediante tests el cálculo actual de venta, pago mixto, cortesía, descuento empleado, cancelación, inventario, cash expected, cierre y sobre. Agregar de inmediato reproducciones de doble cancelación y llamadas directas a Server Actions sin permiso; deben fallar hasta implementar la contención aprobada.
