import "server-only";
import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "@/lib/pos2/authorization";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { randomUUID } from "node:crypto";
import { applyInventoryMovementsBatch } from "./applyMovements";

export const receiveInventory = (i: { branchId: string; inventoryProductId: string; quantity: string; unit: CatalogBaseUnit; reason: string; sourceId: string; actor: CommandActor; operationId: string }) => applyInventoryMovementsBatch({ branchId: i.branchId, actor: i.actor, operationId: i.operationId, capability: "inventory.receive", auditAction: "INVENTORY_RECEIVED", movements: [{ inventoryProductId: i.inventoryProductId, quantityDelta: i.quantity, unit: i.unit, movementType: "RECEIPT", sourceType: "RECEIPT", sourceId: i.sourceId, reasonCode: i.reason }] });
export const adjustInventory = (i: { branchId: string; inventoryProductId: string; delta: string; unit: CatalogBaseUnit; reason: string; actor: CommandActor; operationId: string }) => { if (i.reason.trim().length < 3) throw new DomainError("VALIDATION_ERROR", { field: "reason" }); return applyInventoryMovementsBatch({ branchId: i.branchId, actor: i.actor, operationId: i.operationId, capability: "inventory.adjust", auditAction: "INVENTORY_ADJUSTED", movements: [{ inventoryProductId: i.inventoryProductId, quantityDelta: i.delta, unit: i.unit, movementType: new Prisma.Decimal(i.delta).isPositive() ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", sourceType: "MANUAL_ADJUSTMENT", sourceId: i.operationId, reasonCode: i.reason.trim() }] }); };

export async function countInventory(i: { branchId: string; inventoryProductId: string; declaredQuantity: string; unit: CatalogBaseUnit; notes?: string; actor: CommandActor; operationId: string }) {
  const declared = new Prisma.Decimal(i.declaredQuantity); if (declared.isNegative()) throw new DomainError("INVALID_INVENTORY_DELTA");
  return executeIdempotent({ operationId: i.operationId, command: "CountInventory", payload: { branchId: i.branchId, inventoryProductId: i.inventoryProductId, declaredQuantity: declared.toFixed(6), unit: i.unit, notes: i.notes ?? null }, receiptContext: { actorId: i.actor.id, branchId: i.branchId }, execute: async (tx) => {
    requireActorBranch(i.actor, i.branchId); await requireCapability(tx, i.actor, "inventory.count", i.branchId);
    const product = await tx.inventoryProduct.findUnique({ where: { id: i.inventoryProductId } }); if (!product?.trackStock || !product.inventoryBaseUnit) throw new DomainError("INVENTORY_NOT_TRACKED"); if (product.inventoryBaseUnit !== i.unit) throw new DomainError("INVENTORY_UNIT_MISMATCH");
    await tx.$executeRaw`INSERT INTO "InventoryBalance" ("id","branchId","inventoryProductId","quantity","unit","version","createdAt","updatedAt") VALUES (${randomUUID()},${i.branchId},${i.inventoryProductId},0,${i.unit}::"CatalogBaseUnit",1,NOW(),NOW()) ON CONFLICT ("branchId","inventoryProductId") DO NOTHING`;
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: Prisma.Decimal }>>`SELECT "id","quantity" FROM "InventoryBalance" WHERE "branchId"=${i.branchId} AND "inventoryProductId"=${i.inventoryProductId} FOR UPDATE`;
    const balance = locked[0]; const expected = balance.quantity; const delta = declared.minus(expected); let movementId: string | null = null;
    if (!delta.isZero()) { const outcome = await tx.inventoryMovement.create({ data: { branchId: i.branchId, inventoryProductId: i.inventoryProductId, movementType: "COUNT_CORRECTION", quantityDelta: delta, unit: i.unit, balanceBefore: expected, balanceAfter: declared, sourceType: "COUNT", sourceId: i.operationId, actorId: i.actor.id, operationId: i.operationId, reasonCode: "PHYSICAL_COUNT" } }); movementId = outcome.id; await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantity: declared, version: { increment: 1 } } }); }
    const count = await tx.inventoryCountDeclaration.create({ data: { branchId: i.branchId, inventoryProductId: i.inventoryProductId, expectedQuantity: expected, declaredQuantity: declared, unit: i.unit, movementId, actorId: i.actor.id, operationId: i.operationId, notes: i.notes } }); await appendAuditEvent(tx, { actorId: i.actor.id, branchId: i.branchId, action: "INVENTORY_COUNTED", entityType: "InventoryCountDeclaration", entityId: count.id, operationId: i.operationId, metadata: { expected: expected.toFixed(6), declared: declared.toFixed(6), correction: delta.toFixed(6) } }); return { type: "InventoryCountDeclaration", id: count.id, expected: expected.toFixed(6), declared: declared.toFixed(6), correction: delta.toFixed(6), movementId } as Prisma.InputJsonObject;
  } });
}
