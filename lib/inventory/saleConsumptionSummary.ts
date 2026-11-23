/**
 * A single inventory product may have POS movements in several branches and
 * multiple group-by rows. Combine those rows without adding incompatible units
 * or treating reversals as new consumption.
 */
export type ConsumptionGroup = {
  inventoryProductId: string;
  branchId: string;
  unit: string;
  movementType: "SALE_CONSUMPTION" | "SALE_REVERSAL";
  quantityDelta: number;
  movements: number;
};

export type ConsolidatedConsumption = {
  inventoryProductId: string;
  unit: string;
  amount: number;
  saleMovements: number;
  reversalMovements: number;
  branches: Array<{ branchId: string; amount: number }>;
};

export function consolidateSaleConsumption(
  groups: ConsumptionGroup[],
): ConsolidatedConsumption[] {
  const products = new Map<string, {
    inventoryProductId: string;
    unit: string;
    net: number;
    saleMovements: number;
    reversalMovements: number;
    branches: Map<string, number>;
  }>();

  for (const group of groups) {
    if (!Number.isFinite(group.quantityDelta) || !Number.isFinite(group.movements)) continue;
    // Inventory V2 tracks negative stock deltas for sales and positive for reversals.
    const signedConsumption = group.movementType === "SALE_CONSUMPTION"
      ? Math.max(0, -group.quantityDelta)
      : -Math.max(0, group.quantityDelta);
    const key = `${group.inventoryProductId}:${group.unit}`;
    const value = products.get(key) ?? {
      inventoryProductId: group.inventoryProductId,
      unit: group.unit,
      net: 0,
      saleMovements: 0,
      reversalMovements: 0,
      branches: new Map<string, number>(),
    };
    value.net += signedConsumption;
    value.branches.set(group.branchId, (value.branches.get(group.branchId) ?? 0) + signedConsumption);
    if (group.movementType === "SALE_CONSUMPTION") {
      value.saleMovements += group.movements;
    } else {
      value.reversalMovements += group.movements;
    }
    products.set(key, value);
  }

  return [...products.values()].map((product) => ({
    inventoryProductId: product.inventoryProductId,
    unit: product.unit,
    amount: Math.max(0, product.net),
    saleMovements: product.saleMovements,
    reversalMovements: product.reversalMovements,
    branches: [...product.branches.entries()]
      .map(([branchId, amount]) => ({ branchId, amount: Math.max(0, amount) }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount),
  }));
}
