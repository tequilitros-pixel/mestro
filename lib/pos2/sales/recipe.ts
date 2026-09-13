import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";

type Line = { id: string; productId: string | null; variantId: string | null; quantity: Prisma.Decimal };

export async function resolveSaleInventory(tx: Prisma.TransactionClient, saleId: string, lines: Line[]) {
  const productIds = lines.map((line) => line.productId).filter((id): id is string => Boolean(id));
  const variantIds = lines.map((line) => line.variantId).filter((id): id is string => Boolean(id));
  const products = await tx.posProduct.findMany({ where: { id: { in: productIds } } });
  const variants = await tx.posProductVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true, ingredients: { include: { inventoryProduct: true } } } });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const raw = [];
  for (const line of lines) {
    const variant = line.variantId ? variantMap.get(line.variantId) : null;
    const product = variant?.product ?? (line.productId ? productMap.get(line.productId) : null);
    if (!product) throw new DomainError("PRODUCT_UNAVAILABLE", { lineId: line.id });
    if (!product.inventoryTracked) continue;
    if (!variant || !variant.ingredients.length) throw new DomainError("INVENTORY_MAPPING_NOT_CONFIGURED", { lineId: line.id, productId: product.id });
    for (const ingredient of variant.ingredients) {
      if (ingredient.unitStatus !== "RESOLVED" || !ingredient.unit) throw new DomainError("RECIPE_UNIT_UNRESOLVED", { lineId: line.id, ingredientId: ingredient.id });
      if (!ingredient.inventoryProduct.trackStock || !ingredient.inventoryProduct.inventoryBaseUnit) throw new DomainError("INVENTORY_NOT_TRACKED", { inventoryProductId: ingredient.inventoryProductId });
      if (ingredient.inventoryProduct.inventoryBaseUnit !== ingredient.unit) throw new DomainError("INVENTORY_UNIT_MISMATCH", { ingredientId: ingredient.id });
      raw.push({ inventoryProductId: ingredient.inventoryProductId, quantityDelta: ingredient.quantity.times(line.quantity).negated().toString(), unit: ingredient.unit as CatalogBaseUnit, movementType: "SALE_CONSUMPTION" as const, sourceType: "SALE" as const, sourceId: saleId, sourceLineId: line.id, reasonCode: "POS2_SALE", metadata: { ingredientId: ingredient.id } });
    }
  }
  return raw.length ? groupInventoryDeltas(raw) : [];
}
