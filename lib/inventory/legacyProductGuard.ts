import { DomainError } from "@/lib/domain/errors";

export type LegacyInventoryProductLike = {
  id: string;
  name: string;
  archivedAt: Date | string | null;
};

export function assertLegacyInventoryProductUsable(
  product: LegacyInventoryProductLike | undefined,
) {
  if (!product) {
    throw new DomainError("INVENTORY_ITEM_NOT_FOUND");
  }
  if (product.archivedAt) {
    throw new DomainError("INVENTORY_NOT_TRACKED", {
      productId: product.id,
      product: product.name,
    });
  }
}
