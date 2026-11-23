# Plan de corrección y conciliación — Maestro
**Fecha:** 23 de noviembre de 2026 (America/Mexico_City)
**Alcance:** POS offline, inventario de sucursales, conteos semanales, cortes de caja y costos de insumos.
**Regla:** preservar rastro de auditoría. No reescribir movimientos históricos ni inventar facturas, pagos, existencias o costos.

## 1. Seguridad del cobro offline — Prioridad crítica
**Hallazgo:** la cola incluía operaciones `cancelled`, `failed` y `syncing` durante reenvíos periódicos.

**Corrección implementada en rama:** transiciones atómicas IndexedDB para reclamar, completar, marcar fallida, cancelar y reintentar; única operación `pending` puede pasar a `syncing`; un error detiene la cola y requiere intervención; cancelación se preserva; IDs reutilizados no sobrescriben solicitudes previas. Pruebas unitarias de la política de estado.

**Verificación:** cancelación en una pestaña mientras otra sincroniza; pérdida de red tras confirmar en servidor; error 401, 403 y 500; ventas sin conexión y reconexión; correo de recibo bloqueado hasta que la venta exista. Revisar manualmente cualquier operación que quede `syncing` tras cerrar navegador antes de reintentar. El servidor conserva idempotencia por identificador.

## 2. Inventario y conteos — Prioridad alta
**Hallazgos:** los movimientos del ledger mantienen invariantes; 70 partidas históricas de 6 conteos tuvieron cambio neto tras captura física; anomalías como 10,000 litros de jugo de limón; precios históricos de 52 partidas expresados por presentación.

**Corrección ya aplicada anteriormente:** guard de recaptura al cierre cuando el saldo neto posterior cambió, conversión de costos por unidad base, separación de descuadres extraordinarios en reportes, aviso de entradas sin justificación.

**Acción implementada en rama actual:** tablero de excepciones de solo lectura por producto, fecha y sucursal.

**Validación pendiente con comprobantes:** comparar ingreso original con factura/traspaso y captura física; corregir solamente con movimiento compensatorio trazable, identificando responsable, justificación y evidencias. Prohibido editar en silencio el ledger o sobrescribir el conteo original.

## 3. Caja y POS — Prioridad alta
**Hallazgos:** los tickets positivos y sus pagos cuadran en la tabla POS. Existen registros históricos de prueba/arranque, ventas antiguas vinculadas a cortes posteriores y un pago de tarjeta por $99 en Barra (27/sept) no reflejado en `CashSalePayment` del corte del 26/sept.

**Acción implementada:** alerta en el detalle de corte cerrado por método de pago y tablero administrativo de conciliación de solo lectura. No se inventa pago o cierre.

**Conciliación externa:** contrastar el comprobante bancario, voucher del cobro, hoja de caja y ventas del día antes de realizar un ajuste auditable, si corresponde.

## 4. Costos faltantes — Prioridad media
**Hallazgos:** insumos con stock `Agua Natural` y `Licor de Granada` no tienen costo comercial; los demás sin precio son predominantemente equipos/utensilios.

**Acción implementada:** aviso de valorización incompleta y enlaces para registrar precio real en catálogo.

**Validación:** adjuntar o verificar factura de compra, seleccionar precio de presentación correcto, validar factor ML/G/piezas y reauditar las cifras del reporte. No asignar precios aproximados automáticamente.

## Puertas de despliegue y verificación
- Crear PR a `main`, compilar Next.js y ejecutar TypeScript.
- Revisar accesos: tablero de conciliación sólo `ADMIN`.
- Probar el modo offline en dispositivo real antes de considerarlo definitivamente validado.
- Confirmar Vercel `READY` y promover el commit exacto a dominios de producción sólo después del build.
- Ejecutar consultas SELECT post-despliegue sobre movimientos, pagos y conteos. Las cifras históricas no deben cambiar a consecuencia del despliegue.
- Todos los movimientos de conciliación que requieran facturas/vouchers quedan pendientes de evidencia.
