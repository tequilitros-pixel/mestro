import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";

export type InventoryRequirement = { productId: string; quantity: Prisma.Decimal | string | number; unit?: CatalogBaseUnit };

export async function consumePosInventory(
  tx: Prisma.TransactionClient,
  input: { branchId: string; saleCode: string; requirements: InventoryRequirement[]; actorId?: string; operationId?: string },
) {
  const required = new Map<string, Prisma.Decimal>();
  for (const item of input.requirements) {
    const quantity = new Prisma.Decimal(item.quantity.toString());
    required.set(item.productId, (required.get(item.productId) ?? new Prisma.Decimal(0)).plus(quantity));
  }
  const productIds = [...required.keys()].sort();
  if (productIds.length === 0) return;

  // Transaction-scoped advisory locks serialize sales touching the same
  // branch/product without introducing a temporary mutable stock table.
  for (const productId of productIds) {
    const lockKey = `${input.branchId}:${productId}`;
    // PostgreSQL declares pg_advisory_xact_lock as returning `void`.
    // Cast it so Prisma's pg adapter can deserialize the query result.
    await tx.$queryRaw<Array<{ lock: string }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lock"
    `;
  }

  const [products, lastCount] = await Promise.all([
    tx.inventoryProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, trackStock: true, inventoryBaseUnit: true },
    }),
    tx.inventoryCount.findFirst({
      where: { branchId: input.branchId, status: "CERRADO" },
      orderBy: { countDate: "desc" },
      include: { items: { where: { productId: { in: productIds } }, select: { productId: true, quantityCounted: true } } },
    }),
  ]);
  const tracked = new Map(products.filter((product) => product.trackStock).map((product) => [product.id, product]));

  const balances = await tx.inventoryBalance.findMany({
    where: { branchId: input.branchId, inventoryProductId: { in: [...tracked.keys()] } },
    select: { inventoryProductId: true },
  });
  const balanceProductIds = new Set(balances.map((balance) => balance.inventoryProductId));
  const units = new Map(input.requirements.filter((item) => item.unit).map((item) => [item.productId, item.unit!]));

  // Initialized POS2 branches use the transactional V2 ledger as the source
  // of truth for legacy /pos sales. Partially initialized branches retain the
  // legacy guard rather than silently mixing stock sources.
  const pos2Ready = Boolean(input.actorId) && productIds.every((productId) => {
    const product = tracked.get(productId);
    return Boolean(product && product.inventoryBaseUnit && units.get(productId) === product.inventoryBaseUnit && balanceProductIds.has(productId));
  });
  if (pos2Ready) {
    const grouped = groupInventoryDeltas([...required.entries()].map(([productId, quantity]) => ({
      inventoryProductId: productId,
      quantityDelta: quantity.negated().toString(),
      unit: units.get(productId)!,
      movementType: "SALE_CONSUMPTION" as const,
      sourceType: "SALE" as const,
      sourceId: input.saleCode,
      reasonCode: "POS_LEGACY_SALE",
    })));
    await applyInventoryBatchInTransaction(tx, {
      branchId: input.branchId,
      movements: grouped,
      actorId: input.actorId!,
      operationId: input.operationId ?? randomUUID(),
    });
    return;
  }

  const periodStart = lastCount?.countDate ?? new Date(0);
  const baseline = new Map((lastCount?.items ?? []).map((item) => [item.productId, item.quantityCounted]));
  const entries = await tx.inventoryEntry.groupBy({
    by: ["productId"],
    where: { branchId: input.branchId, productId: { in: [...tracked.keys()] }, entryDate: { gt: periodStart } },
    _sum: { quantity: true },
  });
  const movementTotals = new Map(entries.map((entry) => [entry.productId, entry._sum.quantity ?? new Prisma.Decimal(0)]));

  for (const productId of productIds) {
    const product = tracked.get(productId);
    if (!product) continue;
    const available = (baseline.get(productId) ?? new Prisma.Decimal(0)).plus(movementTotals.get(productId) ?? 0);
    const needed = required.get(productId)!;
    if (available.lessThan(needed)) {
      throw new DomainError("INSUFFICIENT_STOCK", {
        productId,
        product: product.name,
        available: available.toFixed(3),
        required: needed.toFixed(3),
      });
    }
  }

  await tx.inventoryEntry.createMany({
    data: productIds.map((productId) => ({
      branchId: input.branchId,
      productId,
      type: "VENTA_POS" as const,
      quantity: required.get(productId)!.negated(),
      notes: `Venta POS ${input.saleCode}`,
    })),
  });
}
