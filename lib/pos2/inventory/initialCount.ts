import "server-only";
import { Prisma, type CatalogBaseUnit } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import type { CommandActor } from "@/lib/pos2/authorization";

const contentMultipliers: Record<string, number> = { ML: 1, L: 1000, G: 1, KG: 1000, PIEZAS: 1 };

function nonNegativeDecimal(value: string) {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite() || parsed.isNegative()) throw new Error();
    return parsed;
  } catch {
    throw new DomainError("VALIDATION_ERROR", { field: "countedUnits" });
  }
}

export async function captureInitialInventoryCount(input: {
  branchId: string;
  inventoryProductId: string;
  countedUnits: string;
  captureUnit: "BASE" | "PRESENTATION";
  notes?: string;
  actor: CommandActor;
  operationId: string;
}) {
  const counted = nonNegativeDecimal(input.countedUnits);
  const payload = { branchId: input.branchId, inventoryProductId: input.inventoryProductId, countedUnits: counted.toFixed(6), captureUnit: input.captureUnit, notes: input.notes ?? null };
  return executeIdempotent({ operationId: input.operationId, command: "CaptureInitialInventoryCount", payload, receiptContext: { actorId: input.actor.id, branchId: input.branchId }, execute: async (tx) => {
    requireActorBranch(input.actor, input.branchId);
    await requireCapability(tx, input.actor, "inventory.count", input.branchId);
    const product = await tx.inventoryProduct.findUnique({ where: { id: input.inventoryProductId } });
    if (!product?.isActive || !product.trackStock || !product.inventoryBaseUnit) throw new DomainError("INVENTORY_NOT_TRACKED", { inventoryProductId: input.inventoryProductId });

    let declared = counted;
    if (input.captureUnit === "PRESENTATION") {
      const contentUnit = product.contentUnit;
      const multiplier = contentUnit ? contentMultipliers[contentUnit] : null;
      const normalizedContentPerUnit = product.normalizedContentPerUnit;
      if (!contentUnit || !normalizedContentPerUnit || !multiplier) throw new DomainError("VALIDATION_ERROR", { field: "captureUnit" });
      const normalizedContentUnit = contentUnit === "PIEZAS" ? "UNIT" : ["G", "KG"].includes(contentUnit) ? "G" : "ML";
      if (product.inventoryBaseUnit !== (normalizedContentUnit as CatalogBaseUnit)) throw new DomainError("INVENTORY_UNIT_MISMATCH", { inventoryProductId: product.id });
      declared = counted.times(normalizedContentPerUnit);
    }

    const balance = await tx.inventoryBalance.upsert({ where: { branchId_inventoryProductId: { branchId: input.branchId, inventoryProductId: product.id } }, create: { branchId: input.branchId, inventoryProductId: product.id, quantity: new Prisma.Decimal(0), unit: product.inventoryBaseUnit }, update: {} });
    const [movementCount, declarationCount] = await Promise.all([
      tx.inventoryMovement.count({ where: { branchId: input.branchId, inventoryProductId: product.id } }),
      tx.inventoryCountDeclaration.count({ where: { branchId: input.branchId, inventoryProductId: product.id } }),
    ]);
    if (movementCount > 0 || declarationCount > 0 || !balance.quantity.isZero()) throw new DomainError("INVALID_STATE_TRANSITION", { reason: "INITIAL_COUNT_ALREADY_CAPTURED", inventoryProductId: product.id, branchId: input.branchId });

    let movementId: string | null = null;
    if (!declared.isZero()) {
      const movement = await tx.inventoryMovement.create({ data: { branchId: input.branchId, inventoryProductId: product.id, movementType: "OPENING_BALANCE", quantityDelta: declared, unit: product.inventoryBaseUnit, balanceBefore: new Prisma.Decimal(0), balanceAfter: declared, sourceType: "COUNT", sourceId: input.operationId, actorId: input.actor.id, operationId: input.operationId, reasonCode: "PHYSICAL_INITIAL_COUNT", metadata: { captureUnit: input.captureUnit, countedUnits: counted.toFixed(6), normalizedContentPerUnit: product.normalizedContentPerUnit?.toFixed(6) ?? null } } });
      movementId = movement.id;
    }
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantity: declared, unit: product.inventoryBaseUnit, version: { increment: 1 } } });
    const declaration = await tx.inventoryCountDeclaration.create({ data: { branchId: input.branchId, inventoryProductId: product.id, expectedQuantity: new Prisma.Decimal(0), declaredQuantity: declared, unit: product.inventoryBaseUnit, movementId, actorId: input.actor.id, operationId: input.operationId, notes: input.notes?.trim() || "CONTEO FISICO INICIAL POS2" } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: "INVENTORY_INITIAL_COUNT_CAPTURED", entityType: "InventoryCountDeclaration", entityId: declaration.id, operationId: input.operationId, metadata: { inventoryProductId: product.id, declared: declared.toFixed(6), unit: product.inventoryBaseUnit, movementId } });
    await appendOutboxEvent(tx, { topic: "inventory.initial-count.captured", aggregate: "InventoryCountDeclaration", aggregateId: declaration.id, operationId: input.operationId, payload: { branchId: input.branchId, inventoryProductId: product.id, movementId } });
    return { type: "InventoryInitialCount", id: declaration.id, inventoryProductId: product.id, declared: declared.toFixed(6), unit: product.inventoryBaseUnit, movementId } as Prisma.InputJsonObject;
  } });
}
