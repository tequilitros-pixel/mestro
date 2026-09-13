import type { InventoryCountFrequency, InventoryCountType } from "@prisma/client";

export const INVENTORY_COUNT_TYPES = ["WEEKLY", "MONTHLY"] as const;
export const INVENTORY_COUNT_FREQUENCIES = [
  "UNCLASSIFIED",
  "WEEKLY",
  "MONTHLY_ONLY",
] as const;

export type InventoryCountTypeValue = (typeof INVENTORY_COUNT_TYPES)[number];
export type InventoryCountFrequencyValue =
  (typeof INVENTORY_COUNT_FREQUENCIES)[number];

export function isInventoryCountType(value: string): value is InventoryCountType {
  return (INVENTORY_COUNT_TYPES as readonly string[]).includes(value);
}

export function isInventoryCountFrequency(
  value: string,
): value is InventoryCountFrequency {
  return (INVENTORY_COUNT_FREQUENCIES as readonly string[]).includes(value);
}

export function inventoryCountTypeLabel(
  value: InventoryCountType | InventoryCountTypeValue,
) {
  return value === "MONTHLY" ? "Conteo mensual" : "Conteo semanal";
}

export function inventoryCountFrequencyLabel(
  value: InventoryCountFrequency | InventoryCountFrequencyValue,
) {
  if (value === "WEEKLY") return "Conteo semanal";
  if (value === "MONTHLY_ONLY") return "Sólo conteo mensual";
  return "Pendiente de clasificar";
}

type CountableProduct = {
  isActive?: boolean;
  archivedAt?: Date | string | null;
  trackStock?: boolean;
  countFrequency?: InventoryCountFrequency | InventoryCountFrequencyValue;
};

export function isProductIncludedInInventoryCount(
  product: CountableProduct,
  countType: InventoryCountType | InventoryCountTypeValue,
) {
  if (!product.isActive || product.archivedAt || !product.trackStock) {
    return false;
  }

  return countType === "MONTHLY" || product.countFrequency === "WEEKLY";
}
