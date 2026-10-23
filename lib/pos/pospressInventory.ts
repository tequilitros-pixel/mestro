import "server-only";

import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/domain/errors";

export type PospressInventoryRequirement = {
  inventoryProductId: string;
  quantity: Prisma.Decimal | string | number;
  unit: CatalogBaseUnit;
};

type PospressInventoryDelta = {
  inventoryProductId: string;
  quantityDelta: Prisma.Decimal;
  unit: CatalogBaseUnit;
  sourceId: string;
  sourceLineId?: string;
  movementType: "SALE_CONSUMPTION" | "SALE_REVERSAL";
  sourceType: "SALE" | "CANCELLATION";
  reasonCode: string;
  metadata?: Prisma.InputJsonObject;
};

function groupDeltas(deltas: PospressInventoryDelta[]) {
  const grouped = new Map<string, PospressInventoryDelta>();

  for (const delta of deltas) {
    const key = `${delta.inventoryProductId}:${delta.unit}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantityDelta = existing.quantityDelta.plus(delta.quantityDelta);
      continue;
    }
    grouped.set(key, { ...delta });
  }

  return [...grouped.values()]
    .filter((delta) => !delta.quantityDelta.isZero())
    .sort((a, b) => a.inventoryProductId.localeCompare(b.inventoryProductId));
}

async function applyPospressInventoryDeltas(
  tx: Prisma.TransactionClient,
  input: {
    branchId: string;
    actorId: string;
    operationId: string;
    deltas: PospressInventoryDelta[];
  },
) {
  const grouped = groupDeltas(input.deltas);
  if (!grouped.length) return [];

  const productIds = [...new Set(grouped.map((delta) => delta.inventoryProductId))].sort();
  for (const productId of productIds) {
    const lockKey = `pospress-inventory:${input.branchId}:${productId}`;
    await tx.$queryRaw<Array<{ lock: string }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lock"
    `;
  }

  const products = await tx.inventoryProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, trackStock: true, inventoryBaseUnit: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const delta of grouped) {
    const product = productById.get(delta.inventoryProductId);
    if (!product) {
      throw new DomainError("INVENTORY_ITEM_NOT_FOUND", {
        inventoryProductId: delta.inventoryProductId,
      });
    }
    if (!product.trackStock || !product.inventoryBaseUnit) {
      throw new DomainError("INVENTORY_NOT_TRACKED", {
        inventoryProductId: delta.inventoryProductId,
      });
    }
    if (product.inventoryBaseUnit !== delta.unit) {
      throw new DomainError("INVENTORY_UNIT_MISMATCH", {
        inventoryProductId: delta.inventoryProductId,
        expected: product.inventoryBaseUnit,
        received: delta.unit,
      });
    }
  }

  for (const delta of grouped) {
    await tx.inventoryBalance.upsert({
      where: {
        branchId_inventoryProductId: {
          branchId: input.branchId,
          inventoryProductId: delta.inventoryProductId,
        },
      },
      create: {
        branchId: input.branchId,
        inventoryProductId: delta.inventoryProductId,
        quantity: 0,
        unit: delta.unit,
      },
      update: {},
    });
  }

  const balances = await tx.$queryRaw<
    Array<{
      id: string;
      inventoryProductId: string;
      quantity: Prisma.Decimal;
      unit: CatalogBaseUnit;
    }>
  >`
    SELECT "id", "inventoryProductId", "quantity", "unit"
    FROM "InventoryBalance"
    WHERE "branchId" = ${input.branchId}
      AND "inventoryProductId" IN (${Prisma.join(productIds)})
    ORDER BY "inventoryProductId"
    FOR UPDATE
  `;
  const balanceByProductId = new Map(
    balances.map((balance) => [balance.inventoryProductId, balance]),
  );
  const created = [];

  for (const delta of grouped) {
    const balance = balanceByProductId.get(delta.inventoryProductId);
    if (!balance) throw new Error("POSpress inventory balance was not initialized");

    const balanceAfter = balance.quantity.plus(delta.quantityDelta);
    if (balanceAfter.isNegative()) {
      const product = productById.get(delta.inventoryProductId)!;
      throw new DomainError(
        "INSUFFICIENT_STOCK",
        {
          inventoryProductId: delta.inventoryProductId,
          available: balance.quantity.toFixed(6),
          required: delta.quantityDelta.abs().toFixed(6),
          productName: product.name,
          unit: delta.unit,
        },
        `Falta ${product.name} — disponible ${balance.quantity.toFixed(3)} ${delta.unit}, requerido ${delta.quantityDelta.abs().toFixed(3)} ${delta.unit}`,
      );
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        branchId: input.branchId,
        inventoryProductId: delta.inventoryProductId,
        movementType: delta.movementType,
        quantityDelta: delta.quantityDelta,
        unit: delta.unit,
        balanceBefore: balance.quantity,
        balanceAfter,
        sourceType: delta.sourceType,
        sourceId: delta.sourceId,
        sourceLineId: delta.sourceLineId,
        actorId: input.actorId,
        operationId: input.operationId,
        reasonCode: delta.reasonCode,
        metadata: delta.metadata,
      },
    });

    await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: { quantity: balanceAfter, version: { increment: 1 } },
    });

    balance.quantity = balanceAfter;
    created.push(movement);
  }

  return created;
}

export function consumePospressInventoryV2(
  tx: Prisma.TransactionClient,
  input: {
    branchId: string;
    actorId: string;
    saleId: string;
    operationId?: string;
    requirements: PospressInventoryRequirement[];
  },
) {
  const operationId = input.operationId ?? randomUUID();
  return applyPospressInventoryDeltas(tx, {
    branchId: input.branchId,
    actorId: input.actorId,
    operationId,
    deltas: input.requirements.map((requirement) => ({
      inventoryProductId: requirement.inventoryProductId,
      quantityDelta: new Prisma.Decimal(requirement.quantity).negated(),
      unit: requirement.unit,
      sourceId: input.saleId,
      movementType: "SALE_CONSUMPTION" as const,
      sourceType: "SALE" as const,
      reasonCode: "POSPRESS_SALE",
    })),
  });
}

export function reversePospressInventoryV2(
  tx: Prisma.TransactionClient,
  input: {
    branchId: string;
    actorId: string;
    operationId: string;
    cancellationId: string;
    movements: Array<{
      id: string;
      inventoryProductId: string;
      quantityDelta: Prisma.Decimal;
      unit: CatalogBaseUnit;
      sourceLineId: string | null;
    }>;
  },
) {
  return applyPospressInventoryDeltas(tx, {
    branchId: input.branchId,
    actorId: input.actorId,
    operationId: input.operationId,
    deltas: input.movements.map((movement) => ({
      inventoryProductId: movement.inventoryProductId,
      quantityDelta: movement.quantityDelta.abs(),
      unit: movement.unit,
      sourceId: input.cancellationId,
      sourceLineId: movement.sourceLineId ?? undefined,
      movementType: "SALE_REVERSAL" as const,
      sourceType: "CANCELLATION" as const,
      reasonCode: "POSPRESS_SALE_CANCELLED",
      metadata: { originalMovementId: movement.id },
    })),
  });
}
