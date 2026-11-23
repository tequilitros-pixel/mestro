import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { getNormalizedContentPerUnit, type InventoryProductUnitConfig } from "@/lib/inventory/units";

/**
 * POS recipes are normally stored in the stock item's base unit.
 * Older recipes may describe a whole commercial piece (UNIT) while
 * the inventory ledger tracks its physical content (ML or G).
 * Convert only with an explicit, validated product presentation.
 */
export function normalizePosRecipeQuantity(
  quantity: Prisma.Decimal | string | number,
  recipeUnit: CatalogBaseUnit,
  product: InventoryProductUnitConfig & { inventoryBaseUnit: CatalogBaseUnit | null },
): { quantity: Prisma.Decimal; unit: CatalogBaseUnit } | null {
  const baseUnit = product.inventoryBaseUnit;
  if (!baseUnit) return null;

  const amount = new Prisma.Decimal(quantity);
  if (recipeUnit === baseUnit) return { quantity: amount, unit: baseUnit };

  if (recipeUnit !== "UNIT" || product.handlingUnit !== "PIEZA") return null;

  const quantityPerPiece = getNormalizedContentPerUnit(product);
  if (quantityPerPiece === null) return null;

  return { quantity: amount.times(quantityPerPiece), unit: baseUnit };
}
