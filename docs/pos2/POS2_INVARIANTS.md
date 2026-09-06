# POS 2.0 — Invariantes ejecutables

Cada regla tendrá al menos una prueba de integración; las marcadas C también prueba de concurrencia y las S prueba de seguridad.

## Financieras

1. Un `operationId` completado crea como máximo una Sale y siempre reproduce el mismo resultado. **C**
2. Misma key con payload hash distinto se rechaza y nunca ejecuta.
3. Una Order origina como máximo una Sale.
4. Sale.total = subtotal + tax − descuentos/promociones, con Decimal y regla de redondeo única.
5. Suma de Payment CAPTURED = Sale.total al finalizar; no se admiten pagos pendientes/inciertos.
6. Payment amount y currency son inmutables tras captura.
7. Suma de Refund COMPLETED por Payment nunca excede su monto capturado menos voids previos. **C**
8. Refund total por Sale nunca excede el total efectivamente pagado reembolsable.
9. Cancel crea documentos compensatorios exactos; no modifica/importes de Sale original.
10. Cada movimiento financiero/caja tiene source, actor/system, operationId, branch y timestamp.
11. CashMovement de CASH sale/refund corresponde uno-a-uno con su Payment/Refund.
12. El efectivo esperado se deriva del ledger; CashCut es snapshot, nunca fuente de movimientos.
13. Una CashSession FINALIZED/CLOSED no acepta nuevos pagos o movimientos salvo ajuste posterior explícito en una sesión/flujo autorizado.
14. Cada venta conserva snapshots de catálogo, precio, impuesto, promociones y autorizaciones.
15. Ninguna tabla histórica financiera permite delete/cascade desde catálogo/usuario.
16. Business number es único en su serie y nunca se reutiliza.
17. Toda autorización superior registra quién, cuándo, capacidad y contexto aprobado. **S**
18. Dinero V2 nunca pasa por Float/JavaScript number durante cálculo/persistencia.

## Inventario

19. InventoryMovement es append-only; corrección/reversal es otra fila enlazada.
20. Toda cantidad está expresada en unidad base y conserva conversión de captura.
21. Stock disponible nunca queda negativo bajo política predeterminada. **C**
22. CompleteSale comprueba y consume todos los ingredientes de la receta snapshot en la misma tx.
23. Dos ventas concurrentes por el último stock: exactamente una puede consumirlo si ambas excederían disponible. **C**
24. Return no supera cantidad vendida menos retornada previamente. **C**
25. Restock de Return usa disposición explícita; WASTE/INSPECTION no aumenta stock vendible.
26. Cancel/Return crea movement de reversión enlazado al movement original; no infiere por texto.
27. Transfer crea OUT e IN con mismo transferId atómicamente; nunca solo un lado.
28. Waste y Adjustment requieren reason y capacidad adecuada. **S**
29. Conteo genera `COUNT_CORRECTION`; no reemplaza ni borra ledger.
30. Una receta publicada usada por Sale no cambia; nueva composición crea RecipeVersion.
31. Cada componente de movimiento es único por operationId y ordinal.
32. La proyección InventoryBalance debe reconciliar exactamente con suma del ledger desde baseline firmado.

## Operativas, seguridad y scope

33. Solo un CashSession OPEN/CLOSING por Register. **C**
34. Terminal ACTIVE pertenece al Register/Branch del comando.
35. El actor tiene capability y scope para cada recurso; ocultar UI nunca concede ni sustituye permiso. **S**
36. IDs de otra branch no revelan ni modifican recursos. **S**
37. BranchProductOverride no cambia una Sale histórica.
38. Configuraciones y precios publicados son inmutables/versionados.
39. AuditEvent se inserta en la misma tx que el hecho auditado.
40. Fallo antes de commit no deja Sale, ledgers o estado Order parciales.

## Estrategia anti-overselling

Recomendación para PostgreSQL + Prisma: **fila de balance bloqueada + ledger**, no `Serializable` global ni reservas en primera generación.

1. Mantener `InventoryBalance(branchId,itemId,onHand,version)` como proyección transaccional con unique branch+item.
2. Ordenar todas las claves `(branchId,itemId)` para evitar deadlocks.
3. Dentro de CompleteSale, adquirir `SELECT ... FOR UPDATE` para balances requeridos.
4. Verificar `onHand >= required`; si no, abortar con `INSUFFICIENT_STOCK` y detalle sanitizado.
5. Insertar movimientos y decrementar balances en la misma tx.
6. Reintentar deadlock/serialization conflict con backoff acotado en la capa command.

Atomic update condicional es viable para una sola fila, pero varias recetas complican rollback/diagnóstico; row locks ordenados son más claros. Serializable para toda venta añade aborts innecesarios en hora pico. Reservas se posponen: Order no retiene stock en V1; si más adelante hay pedidos prolongados/offline garantizado, se añadirá Reservation con TTL y disponibilidad=`onHand-reserved`.
