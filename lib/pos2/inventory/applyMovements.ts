import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type CatalogBaseUnit, type InventoryMovementSourceType, type InventoryMovementTypeV2 } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { groupInventoryDeltas } from "./domain";

export type MovementInput = { inventoryProductId: string; quantityDelta: string; unit: CatalogBaseUnit; movementType: InventoryMovementTypeV2; sourceType: InventoryMovementSourceType; sourceId: string; sourceLineId?: string; reasonCode: string; metadata?: Prisma.InputJsonObject };

export async function applyInventoryMovementsBatch(input: { branchId: string; movements: MovementInput[]; actor: CommandActor; operationId: string; capability?: "inventory.adjust" | "inventory.receive" | "inventory.count"; auditAction?: string }) {
  if (!input.movements.length) throw new DomainError("INVALID_INVENTORY_DELTA");
  let grouped; try { grouped = groupInventoryDeltas(input.movements); } catch { throw new DomainError("INVALID_INVENTORY_DELTA"); }
  if (!grouped.length) throw new DomainError("INVALID_INVENTORY_DELTA");
  const payload = { branchId: input.branchId, movements: input.movements.map((m) => ({ ...m, metadata: m.metadata ?? null })) };
  return executeIdempotent({ operationId: input.operationId, command: "ApplyInventoryMovementsBatch", payload, receiptContext: { actorId: input.actor.id, branchId: input.branchId }, execute: async (tx) => {
    requireActorBranch(input.actor, input.branchId); await requireCapability(tx, input.actor, input.capability ?? "inventory.adjust", input.branchId);
    const result = await applyInventoryBatchInTransaction(tx, { branchId: input.branchId, movements: grouped, actorId: input.actor.id, operationId: input.operationId });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: input.auditAction ?? "INVENTORY_MOVEMENTS_APPLIED", entityType: "InventoryMovementBatch", entityId: input.operationId, operationId: input.operationId, metadata: { movementCount: result.length, productCount: grouped.length } });
    await appendOutboxEvent(tx, { topic: "inventory.movements.applied", aggregate: "InventoryMovementBatch", aggregateId: input.operationId, operationId: input.operationId, payload: { branchId: input.branchId, movementIds: result.map((r) => r.id) } });
    return { type: "InventoryMovementBatch", id: input.operationId, movements: result.map((r) => ({ id: r.id, inventoryProductId: r.inventoryProductId, balanceBefore: r.balanceBefore.toFixed(6), balanceAfter: r.balanceAfter.toFixed(6) })) } as Prisma.InputJsonObject;
  } });
}

export async function applyInventoryBatchInTransaction(tx: Prisma.TransactionClient, input: { branchId: string; movements: Array<MovementInput & { delta: Prisma.Decimal; sourceLineIds: string[] }>; actorId: string; operationId: string; failAfterFirstMovementForTest?: boolean }) {
  const ids = input.movements.map((m) => m.inventoryProductId);
  const products = await tx.inventoryProduct.findMany({ where: { id: { in: ids } }, select: { id: true, trackStock: true, inventoryBaseUnit: true } });
  const map = new Map(products.map((p) => [p.id, p]));
  for (const item of input.movements) { const product = map.get(item.inventoryProductId); if (!product) throw new DomainError("INVENTORY_ITEM_NOT_FOUND", { inventoryProductId: item.inventoryProductId }); if (!product.trackStock || !product.inventoryBaseUnit) throw new DomainError("INVENTORY_NOT_TRACKED", { inventoryProductId: item.inventoryProductId }); if (product.inventoryBaseUnit !== item.unit) throw new DomainError("INVENTORY_UNIT_MISMATCH", { inventoryProductId: item.inventoryProductId, expected: product.inventoryBaseUnit, received: item.unit }); }
  for (const item of input.movements) {
    await tx.$executeRaw`INSERT INTO "InventoryBalance" ("id","branchId","inventoryProductId","quantity","unit","version","createdAt","updatedAt") VALUES (${randomUUID()},${input.branchId},${item.inventoryProductId},0,${item.unit}::"CatalogBaseUnit",1,NOW(),NOW()) ON CONFLICT ("branchId","inventoryProductId") DO NOTHING`;
  }
  const balances = await tx.$queryRaw<Array<{ id: string; inventoryProductId: string; quantity: Prisma.Decimal; unit: CatalogBaseUnit; version: number }>>`SELECT "id","inventoryProductId","quantity","unit","version" FROM "InventoryBalance" WHERE "branchId"=${input.branchId} AND "inventoryProductId" IN (${Prisma.join(ids)}) ORDER BY "inventoryProductId" FOR UPDATE`;
  const balanceMap = new Map(balances.map((b) => [b.inventoryProductId, b])); const created = [];
  for (const item of input.movements) { const balance = balanceMap.get(item.inventoryProductId)!; const after = balance.quantity.plus(item.delta); if (after.isNegative()) throw new DomainError("INSUFFICIENT_STOCK", { inventoryProductId: item.inventoryProductId, available: balance.quantity.toFixed(6), required: item.delta.abs().toFixed(6) }); const movement = await tx.inventoryMovement.create({ data: { branchId: input.branchId, inventoryProductId: item.inventoryProductId, movementType: item.movementType, quantityDelta: item.delta, unit: item.unit, balanceBefore: balance.quantity, balanceAfter: after, sourceType: item.sourceType, sourceId: item.sourceId, sourceLineId: item.sourceLineId, actorId: input.actorId, operationId: input.operationId, reasonCode: item.reasonCode, metadata: { ...(item.metadata ?? {}), sourceLineIds: item.sourceLineIds } } }); await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantity: after, version: { increment: 1 } } }); created.push(movement); if (input.failAfterFirstMovementForTest && created.length === 1 && process.env.NODE_ENV !== "production") throw new Error("TEST_FAILURE_AFTER_FIRST_INVENTORY_MOVEMENT"); }
  return created;
}
