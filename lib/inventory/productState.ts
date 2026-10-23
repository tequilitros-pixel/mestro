export type InventoryProductArchiveState = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type InventoryProductStateLike = {
  isActive: boolean;
  archivedAt: Date | string | null | undefined;
};

/**
 * `isActive` keeps the operational enabled/disabled choice. `archivedAt`
 * overrides that choice only for the lifecycle state, so restoring a product
 * does not silently turn an intentionally inactive product back on.
 */
export function getInventoryProductState(
  product: InventoryProductStateLike,
): InventoryProductArchiveState {
  if (product.archivedAt) return "ARCHIVED";
  return product.isActive ? "ACTIVE" : "INACTIVE";
}

export function isOperationalInventoryProduct(
  product: InventoryProductStateLike & { trackStock?: boolean },
) {
  return product.isActive && !product.archivedAt && product.trackStock !== false;
}
