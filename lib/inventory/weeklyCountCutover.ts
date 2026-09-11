import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { appendAuditEvent } from "@/lib/pos2/audit";

export async function reconcileWeeklyCountCutover(
  tx: Prisma.TransactionClient,
  input: { countId: string; actorId: string; operationId: string; failAfterProductId?: string },
) {
  const lockedCount = await tx.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id", "status"::text FROM "InventoryCount" WHERE "id"=${input.countId} FOR UPDATE`;
  if (!lockedCount[0]) throw new Error("COUNT_NOT_FOUND");
  if (lockedCount[0].status === "CERRADO") throw new Error("COUNT_ALREADY_CLOSED");
  const count = await tx.inventoryCount.findUnique({ where: { id: input.countId }, include: { items: { include: { product: true } } } });
  if (!count) throw new Error("COUNT_NOT_FOUND");

  const reconciled: Array<{ productId: string; before: string; after: string; movementId: string | null }> = [];
  for (const item of count.items) {
    const product = item.product;
    if (!product.isActive || !product.trackStock || !product.inventoryBaseUnit) continue;
    const counted = new Prisma.Decimal(item.quantityCounted);
    if (counted.isNegative()) throw new Error("INVALID_COUNT");
    await tx.$executeRaw`INSERT INTO "InventoryBalance" ("id","branchId","inventoryProductId","quantity","unit","version","createdAt","updatedAt") VALUES (${randomUUID()},${count.branchId},${product.id},0,${product.inventoryBaseUnit}::"CatalogBaseUnit",1,NOW(),NOW()) ON CONFLICT ("branchId","inventoryProductId") DO NOTHING`;
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: Prisma.Decimal }>>`SELECT "id","quantity" FROM "InventoryBalance" WHERE "branchId"=${count.branchId} AND "inventoryProductId"=${product.id} FOR UPDATE`;
    const balance = locked[0];
    if (!balance) throw new Error("BALANCE_NOT_FOUND");
    const delta = counted.minus(balance.quantity);
    let movementId: string | null = null;
    if (!delta.isZero()) {
      const movement = await tx.inventoryMovement.create({ data: { branchId: count.branchId, inventoryProductId: product.id, movementType: "COUNT_CORRECTION", quantityDelta: delta, unit: product.inventoryBaseUnit, balanceBefore: balance.quantity, balanceAfter: counted, sourceType: "COUNT", sourceId: input.countId, actorId: input.actorId, operationId: input.operationId, reasonCode: "WEEKLY_PHYSICAL_COUNT_CUTOVER", metadata: { countId: input.countId, authoritative: true } } });
      movementId = movement.id;
      await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantity: counted, version: { increment: 1 } } });
    }
    reconciled.push({ productId: product.id, before: balance.quantity.toFixed(6), after: counted.toFixed(6), movementId });
    await tx.inventoryCountItem.update({ where: { id: item.id }, data: { entriesQuantity: 0, quantityConsumed: 0, unitCostAtTime: product.unitCost, costTotal: 0 } });
    if (input.failAfterProductId === product.id) throw new Error("TEST_FAILURE_AFTER_RECONCILIATION");
  }
  await tx.inventoryCount.update({ where: { id: input.countId }, data: { status: "CERRADO" } });
  await appendAuditEvent(tx, { actorId: input.actorId, branchId: count.branchId, action: "INVENTORY_COUNT_CUTOVER", entityType: "InventoryCount", entityId: input.countId, operationId: input.operationId, metadata: { countId: input.countId, reconciled } });
  return { type: "InventoryCountCutover", id: input.countId, branchId: count.branchId, reconciled } as Prisma.InputJsonObject;
}
