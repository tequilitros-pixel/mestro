import { Prisma } from "@prisma/client";

/**
 * Determina qué productos deben contarse nuevamente antes de cerrar la caja
 * de inventario: ventas, recepciones o ajustes posteriores a la captura física
 * alteran la existencia que se debe comparar. Los movimientos netos cero
 * (por ejemplo, venta y cancelación) no obligan a recaptura.
 */
export function countProductsNeedingRecapture(
  captures: Array<{ productId: string; countedAt: Date }>,
  movements: Array<{ inventoryProductId: string; createdAt: Date; quantityDelta: Prisma.Decimal }>,
): string[] {
  const pending = new Set<string>();
  for (const capture of captures) {
    let changed = new Prisma.Decimal(0);
    for (const movement of movements) {
      if (capture.productId === movement.inventoryProductId
        && movement.createdAt.getTime() > capture.countedAt.getTime()) {
        changed = changed.plus(movement.quantityDelta);
      }
    }
    if (!changed.isZero()) pending.add(capture.productId);
  }
  return [...pending];
}
