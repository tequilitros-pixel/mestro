# POS 2.0 — Fase 3I: Promotions, Discounts & Courtesy Engine

## Decisiones cerradas

- `PriceVersion` sigue representando exclusivamente precio de lista. Ningún descuento modifica Pricing V2.
- Una política nace como `AdjustmentDefinition` y cada publicación crea un `AdjustmentVersion` inmutable. Su retiro se expresa con `AdjustmentVersionTermination`, también append-only.
- La evaluación usa `Decimal` y asignación determinista de centavos por mayor residuo, con desempate por identificador de línea.
- Las promociones automáticas se ordenan por prioridad, mayor beneficio e identificador estable. `EXCLUSIVE` elige una; `STACKABLE` aplica reglas explícitamente apilables sin llevar una línea debajo de cero.
- Targets: producto, variante, categoría u orden completa. Scope: global o sucursal. Incluye exclusiones, vigencia, días y ventana horaria con zona IANA.
- Descuento manual, descuento de empleado y cortesía son comandos separados por capabilities. Una cortesía exige motivo y autorización; el beneficiario no puede autoautorizarse.
- `OrderAdjustment` es mutable únicamente de `APPLIED` a `REVOKED`; nunca se borra. Las líneas y total de la orden son una proyección de ajustes activos.
- `CompleteSale` vuelve a validar promociones y descuentos congelados, crea `SaleAdjustment` dentro de la misma transacción y conserva código, nombre, mecánica, porcentaje, beneficiario, autorización, motivo e importe históricos.
- Cancelaciones, devoluciones y reembolsos posteriores trabajan sobre los importes netos históricos de `Pos2Sale`/`Pos2SaleLine`; no reevalúan reglas vigentes.

## Concurrencia e idempotencia

Todos los comandos de orden toman el mismo `FOR UPDATE` y verifican `expectedOrderVersion`. Los commands públicos usan `OperationReceipt`; una repetición con el mismo payload reproduce el resultado y la reutilización con otro payload falla. La publicación serializa versiones por definición con advisory lock.

## Compatibilidad

`PosSettings.employeeDiscountPercent`, `PosProductVariant.employeePrice`, `PosDiscountRule` y los campos Float de Sale V1 permanecen intactos y fuera del flujo POS 2.0. No existe fallback desde V2 hacia esos valores.
