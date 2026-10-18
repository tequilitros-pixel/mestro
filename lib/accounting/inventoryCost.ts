type CostedInventoryProduct = {
  unitCost: unknown;
  inventoryBaseUnit?: unknown;
  normalizedContentPerUnit?: unknown;
};

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Inventory V2 moves ml, g or individual units. Product cost, however, is
 * captured for its commercial presentation (for example a 750 ml bottle).
 * Convert that presentation cost only when the movement is in the base unit.
 */
export function costPerInventoryBaseUnit(product: CostedInventoryProduct) {
  const unitCost = positiveNumber(product.unitCost);
  if (unitCost === null) return null;

  const baseUnit = typeof product.inventoryBaseUnit === "string" ? product.inventoryBaseUnit : "";
  const content = positiveNumber(product.normalizedContentPerUnit);
  return baseUnit && content !== null ? unitCost / content : unitCost;
}

export function inventoryBaseUnitLabel(value: unknown, fallback: string) {
  if (value === "ML") return "ml";
  if (value === "G") return "g";
  if (value === "UNIT") return "unidad";
  return fallback;
}
