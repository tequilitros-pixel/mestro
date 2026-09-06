# POS 2.0 — Arquitectura de catálogo Fase 3C

Fecha de cierre: 2026-08-31.

## Source of truth y convivencia

La estrategia elegida es **evolucionar el catálogo POS existente**:

```text
PosCategory
  └─ PosProduct (identidad empresarial global)
       ├─ PosProductVariant (presentación vendible)
       ├─ PosVariantIngredient → InventoryProduct (receta legacy)
       └─ BranchProductOverride (configuración local)
```

- **Hoy y durante la migración:** `PosCategory`, `PosProduct` y `PosProductVariant` siguen siendo la fuente de verdad para V1 y V2.
- **Inventario/eventos:** `InventoryProduct` continúa siendo su catálogo operativo independiente. Eventos, paquetes, equipos y recetas no fueron migrados ni duplicados.
- **Futuro:** Sales V2 tomará snapshots de identidad/presentación/precio al vender. No se requiere versionar todo el catálogo como CMS para conservar historia.
- No hay dual-write, tablas espejo ni sincronizador. El endpoint y las pantallas V1 continúan leyendo los mismos modelos.

## Auditoría legacy

El POS V1 usa categorías activas, `position`, productos activos, `icon` y variantes activas con `price` Float. `PosVariantIngredient` conecta cada presentación preparada con ingredientes de `InventoryProduct`; venta/cancelación generan movimientos de inventario desde esa receta. Los descuentos usan precios de variante y reglas separadas. `InventoryProduct` también alimenta conteos, eventos, paquetes, equipo, licores y materias primas, por lo que fusionarlo con Product hubiera creado acoplamiento peligroso.

El precio de `PosProductVariant` se conserva únicamente como `legacyPrice` en la lectura V2. Fase 3C no contiene reglas, promociones ni Pricing Engine.

## Categoría

`PosCategory` conserva `name`, `position` y `active`, y agrega:

- `slug` estable, nullable para compatibilidad histórica y único cuando existe;
- descripción, icono/referencia visual y texto alternativo;
- `version` para optimistic concurrency.

No se añadió jerarquía: el negocio actual no demuestra necesidad de categorías anidadas.

## Product global

`PosProduct` representa la identidad empresarial y agrega:

- descripción;
- `sku`, `internalCode` y `barcode`, opcionales y únicos en su espacio;
- `sellable`, `inventoryTracked`, `baseUnit`;
- `active`, `archivedAt` y `version`;
- imagen/referencia existente en `icon` y `imageAlt`.

Semántica:

- `active=false`: fuera de operación/administración normal;
- `sellable=false`: existe pero no puede venderse;
- `archivedAt!=null`: retiro no destructivo;
- `inventoryTracked`: intención global de participar en inventario futuro;
- stock agotado no pertenece al catálogo.

Los productos legacy quedan activos/vendibles y con `inventoryTracked=false` hasta que un administrador confirme su intención V2. Sus recetas V1 siguen descontando inventario sin depender de este nuevo flag.

## Variant / Presentation

`PosProductVariant` sigue representando presentaciones como Mediano, Grande o Único. Agrega SKU/código/barcode, unidad, active, orden y versión. No se obliga a tener múltiples variantes: un producto simple puede tener una sola presentación “Único”. La relación con receta es opcional; servicios, cargos o productos virtuales no necesitan ingredientes.

Crear/editar una variante aún requiere un precio legacy para que V1 pueda operar. El valor no constituye Pricing V2.

## Unidades

El enum `CatalogBaseUnit` admite `UNIT|ML`, el mismo contrato conceptual de Quantity. La UI no acepta strings arbitrarios. Nuevas unidades requerirán una extensión explícita y controlada del dominio.

## BranchProductOverride

Un override por `unique(branchId, productId)` contiene solamente:

- `enabled`: la sucursal maneja el producto;
- `visibleInPos`: se muestra en la cuadrícula;
- `availability`: AVAILABLE o TEMPORARILY_UNAVAILABLE;
- `sortOrder`: orden local opcional;
- `version` y autores.

No duplica nombre, descripción, imagen, unidad ni tracking de inventario. El tracking continúa siendo global para evitar que una misma identidad tenga semántica financiera distinta por sucursal. No contiene precio ni relación de pricing futura activa.

Sin override, el producto global está habilitado y visible en todas las sucursales. Un override puede ocultarlo, deshabilitarlo o marcarlo temporalmente no disponible sin deployment.

## Resolución efectiva

`resolveBranchCatalog(branchId)` centraliza la combinación:

```text
enabled = product.active
       && product.sellable
       && product.archivedAt == null
       && (override.enabled ?? true)

visible = enabled
       && (override.visibleInPos ?? true)
       && (override.availability ?? AVAILABLE) == AVAILABLE

sortOrder = override.sortOrder ?? product.position
```

La consulta obtiene categorías, productos, variantes y el override de una Branch en una sola operación Prisma de cardinalidad constante. Después filtra/ordena en memoria y devuelve un DTO seguro. La búsqueda admite nombre, SKU, código interno y barcode mediante PostgreSQL.

No se añadió Redis ni cache persistente: la lectura directa medida es rápida y garantiza read-after-write inmediato tras administración. Si el volumen futuro exige cache, este servicio es la única frontera que deberá cachearse/invalidarse.

## Imágenes

Se reutiliza el endpoint V1 validado de Vercel Blob (`/api/pos/products/upload-image`): JPG, PNG o WebP, máximo 5 MB. PostgreSQL conserva solo una referencia pública en `icon` y el alt en `imageAlt`; `icon` también tolera emoji legacy. Si la referencia falla, el preview muestra un fallback y el catálogo sigue operativo. Fase 3C no borra blobs automáticamente para no romper referencias históricas o compartidas.

## Administración y lectura

- `/administration/pos2/catalog`: creación/edición/archivo de categorías, productos, variantes y overrides.
- `/administration/pos2/catalog/preview`: lectura efectiva por Branch.
- `GET /api/pos2/catalog?branchId=...&q=...`: DTO efectivo para futuros consumidores POS2.

El alta completa —categoría, producto, variante y disponibilidad local— es dato administrable y no requiere modificar código, migrar ni desplegar.

## Permisos y seguridad

Enforcement real V2:

- `catalog.view`
- `catalog.create`
- `catalog.edit`
- `catalog.archive`
- `catalog.category.manage`
- `catalog.variant.manage`
- `catalog.branch_override.manage`

Crear/modificar identidades empresariales requiere un grant apropiado normalmente GLOBAL. Los overrides aceptan BRANCH/MULTI_BRANCH/GLOBAL y además verifican `actor.branchIds`; manipular el branchId no amplía alcance. ADMIN recibe grants GLOBAL iniciales. Los endpoints/actions vuelven a autenticar y autorizar en servidor.

## Idempotencia, auditoría y concurrencia

Crear Category/Product/Variant usa OperationReceipt. Un retry con el mismo UUIDv7/payload reproduce resultado; un payload distinto falla. Slug/SKU/códigos tienen constraints únicos y los errores concurrentes se traducen a `CONFLICT` seguro.

Category/Product/Variant/Override usan `version`. Los updates incluyen `WHERE id AND version` e incrementan la versión; dos editores con la misma versión producen un éxito y un conflicto, no un overwrite silencioso.

AuditEvent registra created/updated/archived y cambios de override con metadata escalar sanitizada. No almacena binarios ni credenciales.

## Performance DEV

Dataset: 50 categorías, 1,000 productos, 1,000 variantes y 250 overrides. Dos ejecuciones limpias resolvieron el catálogo efectivo en aproximadamente 50.4 ms y 63.7 ms. Son medidas locales orientativas, no un SLA productivo. La forma de consulta es constante y no presenta N+1 por producto.
