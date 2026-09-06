import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { Quantity } from "@/lib/domain/quantity";

export function parseInventoryDelta(value: string, unit: CatalogBaseUnit) {
  const quantity = Quantity.from(value, unit);
  if (quantity.toDecimal().isZero()) throw new Error("zero delta");
  if (unit === "UNIT" && !quantity.toDecimal().isInteger()) throw new Error("fractional UNIT");
  return quantity;
}

export function groupInventoryDeltas<T extends { inventoryProductId: string; quantityDelta: string; unit: CatalogBaseUnit }>(items: T[]) {
  const groups = new Map<string, T & { delta: Prisma.Decimal; sourceLineIds: string[] }>();
  for (const item of items) {
    const delta = parseInventoryDelta(item.quantityDelta, item.unit).toDecimal();
    const current = groups.get(item.inventoryProductId);
    if (current && current.unit !== item.unit) throw new Error("unit mismatch");
    if (current) { current.delta = current.delta.plus(delta); if ("sourceLineId" in item && item.sourceLineId) current.sourceLineIds.push(String(item.sourceLineId)); }
    else groups.set(item.inventoryProductId, { ...item, delta, sourceLineIds: "sourceLineId" in item && item.sourceLineId ? [String(item.sourceLineId)] : [] });
  }
  return [...groups.values()].filter((item) => !item.delta.isZero()).sort((a, b) => a.inventoryProductId.localeCompare(b.inventoryProductId));
}

export function reconcileValues(balance: string, ledger: string) { return new Prisma.Decimal(balance).equals(ledger) ? "MATCH" as const : "MISMATCH" as const; }
