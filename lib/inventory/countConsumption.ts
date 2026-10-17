import { getNormalizedContentPerUnit, type InventoryProductUnitConfig } from "@/lib/inventory/units";

type CostedProduct = InventoryProductUnitConfig & {
  id: string;
  unitCostAtTime: number | null;
};

type CountMovement = {
  productId: string;
  quantity: number;
  type: string;
};

export type CountConsumptionRow = {
  quantity: number | null;
  cost: number | null;
  missingUnitConversion: boolean;
  missingCost: boolean;
};

export function summarizeCountConsumption(
  products: CostedProduct[],
  movements: CountMovement[],
) {
  const rows = new Map<string, CountConsumptionRow>();
  const productById = new Map(products.map((product) => [product.id, product]));
  for (const product of products) {
    rows.set(product.id, {
      quantity: 0,
      cost: 0,
      missingUnitConversion: false,
      missingCost: false,
    });
  }

  for (const movement of movements) {
    const product = productById.get(movement.productId);
    const row = rows.get(movement.productId);
    if (!product || !row) continue;
    const isOut = ["SALE_CONSUMPTION", "EVENT_LOAD"].includes(movement.type);
    const isReturn = ["SALE_REVERSAL", "EVENT_RETURN"].includes(movement.type);
    if (!isOut && !isReturn) continue;

    const factor = getNormalizedContentPerUnit(product);
    const signedQuantity = (isReturn ? -1 : 1) * Math.abs(movement.quantity);
    row.quantity = (row.quantity ?? 0) + signedQuantity;

    const cost = product.unitCostAtTime;
    const unitCostIsCommercial = Boolean(product.handlingUnit);
    if (cost === null || (unitCostIsCommercial && factor === null)) {
      row.missingCost = true;
      row.missingUnitConversion = unitCostIsCommercial && factor === null;
      row.cost = null;
      continue;
    }
    const costPerBase = cost / (factor ?? 1);
    if (row.cost !== null) row.cost += signedQuantity * costPerBase;
  }

  for (const row of rows.values()) {
    if (row.quantity !== null) row.quantity = Math.max(0, row.quantity);
    if (row.cost !== null) row.cost = Math.max(0, row.cost);
  }
  const values = [...rows.values()];
  return {
    rows,
    knownCost: values.reduce((sum, row) => sum + (row.cost ?? 0), 0),
    missingCostProducts: values.filter((row) => row.missingCost || row.missingUnitConversion).length,
  };
}
