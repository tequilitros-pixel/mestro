import "server-only";
import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { groupInventoryDeltas } from "./domain";
import { applyInventoryBatchInTransaction } from "./applyMovements";

export async function transferInventory(i: { fromBranchId: string; toBranchId: string; inventoryProductId: string; quantity: string; unit: CatalogBaseUnit; reason: string; actor: CommandActor; operationId: string }) {
  const amount = new Prisma.Decimal(i.quantity); const payload = { ...i, actor: undefined, quantity: amount.toFixed(6) };
  return executeIdempotent({ operationId: i.operationId, command: "TransferInventory", payload, receiptContext: { actorId: i.actor.id, branchId: i.fromBranchId }, execute: async (tx) => {
    requireActorBranch(i.actor, i.fromBranchId); requireActorBranch(i.actor, i.toBranchId); await requireCapability(tx, i.actor, "inventory.transfer", i.fromBranchId); await requireCapability(tx, i.actor, "inventory.transfer", i.toBranchId);
    const keys = [`${i.fromBranchId}:${i.inventoryProductId}`, `${i.toBranchId}:${i.inventoryProductId}`].sort(); for (const key of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    const out = groupInventoryDeltas([{ inventoryProductId: i.inventoryProductId, quantityDelta: amount.negated().toString(), unit: i.unit, movementType: "TRANSFER_OUT" as const, sourceType: "TRANSFER" as const, sourceId: i.operationId, reasonCode: i.reason }]); const incoming = groupInventoryDeltas([{ inventoryProductId: i.inventoryProductId, quantityDelta: amount.toString(), unit: i.unit, movementType: "TRANSFER_IN" as const, sourceType: "TRANSFER" as const, sourceId: i.operationId, reasonCode: i.reason }]);
    const removed = await applyInventoryBatchInTransaction(tx, { branchId: i.fromBranchId, movements: out, actorId: i.actor.id, operationId: i.operationId }); const added = await applyInventoryBatchInTransaction(tx, { branchId: i.toBranchId, movements: incoming, actorId: i.actor.id, operationId: i.operationId }); await appendAuditEvent(tx, { actorId: i.actor.id, branchId: i.fromBranchId, action: "INVENTORY_TRANSFERRED", entityType: "InventoryTransfer", entityId: i.operationId, operationId: i.operationId, metadata: { toBranchId: i.toBranchId, inventoryProductId: i.inventoryProductId, quantity: amount.toFixed(6), outMovementId: removed[0].id, inMovementId: added[0].id } }); return { type: "InventoryTransfer", id: i.operationId, outMovementId: removed[0].id, inMovementId: added[0].id };
  } });
}
