import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { appendAuditEvent } from "@/lib/pos2/audit";

function declarationOperationId(countId: string, itemId: string, countDate: Date) {
  const entropy = createHash("sha256")
    .update(`InventoryCountDeclaration:${countId}:${itemId}`)
    .digest("hex")
    .slice(0, 20);
  const timestamp = Math.max(0, countDate.getTime())
    .toString(16)
    .padStart(12, "0")
    .slice(-12);
  const hex = `${timestamp}${entropy}`;

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-${
    ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4]
  }${hex.slice(17, 20)}-${hex.slice(20)}`;
}

type ReconciledItem = {
  productId: string;
  before: string;
  after: string;
  unit: CatalogBaseUnit;
  movementId: string | null;
  declarationId: string;
};

export async function reconcileWeeklyCountCutover(
  tx: Prisma.TransactionClient,
  input: { countId: string; actorId: string; operationId: string; failAfterProductId?: string },
) {
  const lockedCount = await tx.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id", "status"::text FROM "InventoryCount" WHERE "id"=${input.countId} FOR UPDATE`;
  if (!lockedCount[0]) throw new Error("COUNT_NOT_FOUND");
  if (lockedCount[0].status === "CERRADO") throw new Error("COUNT_ALREADY_CLOSED");

  const count = await tx.inventoryCount.findUnique({
    where: { id: input.countId },
    include: { items: { include: { product: true } } },
  });
  if (!count) throw new Error("COUNT_NOT_FOUND");

  const pendingItems = count.items.filter(
    (item) => item.quantityCounted === null || item.countedAt === null,
  );
  if (pendingItems.length > 0) {
    throw new Error(`COUNT_ITEMS_PENDING:${pendingItems.length}`);
  }

  const reconciled: ReconciledItem[] = [];
  for (const item of count.items) {
    const product = item.product;
    if (!product.isActive || !product.trackStock || !product.inventoryBaseUnit) continue;

    if (item.quantityCounted === null) throw new Error("COUNT_ITEMS_PENDING:1");
    const counted = new Prisma.Decimal(item.quantityCounted);
    if (counted.isNegative()) throw new Error("INVALID_COUNT");

    await tx.$executeRaw`INSERT INTO "InventoryBalance" ("id","branchId","inventoryProductId","quantity","unit","version","createdAt","updatedAt") VALUES (${randomUUID()},${count.branchId},${product.id},0,${product.inventoryBaseUnit}::"CatalogBaseUnit",1,NOW(),NOW()) ON CONFLICT ("branchId","inventoryProductId") DO NOTHING`;
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: Prisma.Decimal }>>`SELECT "id","quantity" FROM "InventoryBalance" WHERE "branchId"=${count.branchId} AND "inventoryProductId"=${product.id} FOR UPDATE`;
    const balance = locked[0];
    if (!balance) throw new Error("BALANCE_NOT_FOUND");

    const delta = counted.minus(balance.quantity);
    let movementId: string | null = null;
    if (!delta.isZero()) {
      const movement = await tx.inventoryMovement.create({
        data: {
          branchId: count.branchId,
          inventoryProductId: product.id,
          movementType: "COUNT_CORRECTION",
          quantityDelta: delta,
          unit: product.inventoryBaseUnit,
          balanceBefore: balance.quantity,
          balanceAfter: counted,
          sourceType: "COUNT",
          sourceId: input.countId,
          actorId: input.actorId,
          operationId: input.operationId,
          reasonCode: count.countType === "MONTHLY"
            ? "MONTHLY_PHYSICAL_COUNT_CUTOVER"
            : "WEEKLY_PHYSICAL_COUNT_CUTOVER",
          metadata: {
            countId: input.countId,
            countType: count.countType,
            authoritative: true,
          },
        },
      });
      movementId = movement.id;
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantity: counted, version: { increment: 1 } },
      });
    }

    const declaration = await tx.inventoryCountDeclaration.create({
      data: {
        branchId: count.branchId,
        countId: count.id,
        inventoryProductId: product.id,
        expectedQuantity: balance.quantity,
        declaredQuantity: counted,
        unit: product.inventoryBaseUnit,
        movementId,
        actorId: input.actorId,
        operationId: declarationOperationId(count.id, item.id, count.countDate),
        notes: count.notes ?? `Conteo ${count.code}`,
      },
    });

    await tx.inventoryCountItem.update({
      where: { id: item.id },
      data: {
        previousQuantity: balance.quantity,
        entriesQuantity: 0,
        quantityConsumed: 0,
        unitCostAtTime: product.unitCost,
        costTotal: 0,
      },
    });

    reconciled.push({
      productId: product.id,
      before: balance.quantity.toFixed(6),
      after: counted.toFixed(6),
      unit: product.inventoryBaseUnit,
      movementId,
      declarationId: declaration.id,
    });

    if (input.failAfterProductId === product.id) {
      throw new Error("TEST_FAILURE_AFTER_RECONCILIATION");
    }
  }

  const closedAt = new Date();
  await tx.inventoryCount.update({
    where: { id: input.countId },
    data: { status: "CERRADO", closedAt, closedById: input.actorId },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorId,
    branchId: count.branchId,
    action: "INVENTORY_COUNT_CUTOVER",
    entityType: "InventoryCount",
    entityId: input.countId,
    operationId: input.operationId,
    metadata: {
      countId: input.countId,
      countType: count.countType,
      closedAt: closedAt.toISOString(),
      reconciled,
    },
  });

  return {
    type: "InventoryCountCutover",
    id: input.countId,
    branchId: count.branchId,
    reconciled,
  } as Prisma.InputJsonObject;
}
