# POS 2.0 — Fase 3J: Offline, resiliencia y sync

## Garantía de primera generación

Offline permite navegar un snapshot cacheado, crear un draft y editar sus líneas. Precio, promoción, disponibilidad y stock visibles offline son estimaciones con `cachedAt` y revisión. No existe Sale, Payment, captura, reserva de stock, movimiento de inventario, CashMovement ni recibo oficial hasta un ACK del servidor.

`BeginPayment`, descuentos/cortesías autorizados, `CompleteSale`, Cancel, Return, Refund, CashIn/CashOut, cierre de caja y transferencias son online-required. Esta decisión evita fabricar una realidad financiera sin locks de stock, pricing/promotions vigentes, terminal activa, permisos actuales y CashSession abierta.

## Auditoría legacy

- KEEP: IndexedDB como tecnología, registro central de service worker, exclusión de `/api/*` del cache, y validaciones server-side existentes.
- REFACTOR: detección basada únicamente en `navigator.onLine`, cola cronológica global, estados `pending/syncing/failed`, retries sin backoff y diagnostics en `localStorage`.
- REPLACE para POS2: UUIDv4/id usado como identidad, eliminación inmediata de ACK, bloqueo global ante un command fallido y ausencia de dependencias/mappings.
- REMOVE del service worker: cache de respuestas de navegación autenticadas. El v3 usa network-only para navegación con fallback a `offline.html`.
- La cola legacy de producción/cortes no se migra ni altera; POS2 usa `maestro-pos2-offline` aislado.

## IndexedDB v2

Stores: `commands`, `drafts`, `mappings`, `cache` y `meta`. `onupgradeneeded` crea sólo stores ausentes, por lo que upgrades conservan datos. El esquema y cada envelope llevan `schemaVersion: 2`.

Un draft separa `localDraftId`, `serverOrderId`, `serverVersion` y `localRevision`. Reload/reapertura recupera drafts y queue. El mapping local→server se persiste sólo después del ACK de CreateOrder. Clonar una orden irrecuperable genera draft, líneas y futuros operation IDs nuevos.

## Envelope y causalidad

Cada intención se persiste antes de enviarse con UUIDv7, payload canónico, SHA-256, actor/terminal/branch originales, dependencias, intentos, próximo retry, error y resultado. Un hijo sólo se selecciona cuando todos sus prerequisites están `ACKNOWLEDGED`; conflicto/fallo permanente bloquea descendientes, pero no órdenes independientes.

UpdateQuantity pendiente puede compactarse al último valor. No se compactan commands financieros, autorizaciones ni commands ya enviados. ACKs se conservan durante la ventana diagnóstica; una limpieza futura puede resumirlos sin borrar conflictos.

## Sync y resiliencia

El coordinator sigue write-ahead → send → ACK. Una respuesta perdida se recupera reenviando el mismo operationId; `OperationReceipt` reproduce el resultado. Network/408/425/429/5xx usa exponential backoff con jitter y límite. Conflictos de negocio nunca entran en loop automático.

Web Locks elige un leader por navegador; el fallback usa un lease corto de coordinación, no como verdad operacional. La idempotencia server permanece como segunda defensa. El servidor verifica hash, actor activo, terminal credential, branch, capabilities, versión de Order y todos los invariantes del command.

## Conflictos y recovery

`ORDER_VERSION_CONFLICT`, `PRICE_CHANGED`, `PROMOTION_CHANGED`, producto/caja/stock/terminal/permisos y orden finalizada quedan en `CONFLICT`. No hay merge silencioso ni CRDT. Las opciones soportadas conceptualmente son cargar servidor, clonar como nueva Order o reaplicar manualmente.

Logout no elimina drafts. Quedan asociados a terminal, branch y actor original; otro usuario no los hereda ni reatribuye. La terminal credential nunca se escribe en IndexedDB/localStorage en esta implementación: la superficie DEV la mantiene sólo en memoria.

## Cache y configuración

`/api/pos2/sync/config` entrega revisiones de catálogo, pricing, promociones, permisos y terminal con ETag. Un cambio invalida y reemplaza el snapshot completo dentro de una transacción IndexedDB. No se guardan imágenes/blob, PAN, CVV, passwords ni credenciales. El reloj cliente sólo sirve para preview; servidor decide vigencias.

## Startup y observabilidad

Startup: cargar drafts/queue, probar reachability real, autenticar, elegir leader, sincronizar, consultar revisiones y restaurar carrito. Diagnostics locales incluyen pending, edad, conflicts, retries, failed permanent, último sync y edad/revisión del catálogo. `/administration/pos2/sync` expone estos datos sin convertirlos en UI final de caja.

## Service worker

No se depende de Background Sync. El coordinator funciona con la app abierta. El service worker cachea manifest/icons/static assets y una pantalla offline neutra; APIs y navegación autenticada nunca se persisten.
