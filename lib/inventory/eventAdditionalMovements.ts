import "server-only";
import { Prisma, type EventAddedProduct, type InventoryProduct } from "@prisma/client";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";
import { requireLegacyInventoryAvailable } from "@/lib/inventory/manualMovements";
import { appendAuditEvent } from "@/lib/pos2/audit";

export async function recordEventAdditionalMovement(
  tx: Prisma.TransactionClient,
  input: {
    addition: EventAddedProduct;
    product: InventoryProduct;
    branchId: string;
    actorId: string;
    operationId: string;
    returning: boolean;
  },
) {
  const { addition, product, branchId, returning } = input;
  const original = new Prisma.Decimal(addition.quantityOriginal);
  const perUnit = new Prisma.Decimal(addition.normalizedQuantity).div(original);
  const closed = returning
    ? new Prisma.Decimal(addition.returnedQuantity)
    : original;
  const open = returning
    ? new Prisma.Decimal(addition.returnedOpenQuantity ?? 0)
    : new Prisma.Decimal(0);
  const normalized = returning
    ? closed.times(perUnit).plus(open)
    : new Prisma.Decimal(addition.normalizedQuantity);
  if (normalized.isZero()) return null;

  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${branchId}:${product.id}`},0))::text`;
  const balance = await tx.inventoryBalance.findUnique({
    where: { branchId_inventoryProductId: { branchId, inventoryProductId: product.id } },
  });
  let movementId: string | null = null;
  if (balance) {
    if (!product.inventoryBaseUnit || balance.unit !== product.inventoryBaseUnit) {
      throw new Error("La unidad del saldo no coincide con el producto agregado.");
    }
    const delta = returning ? normalized : normalized.negated();
    const movements = await applyInventoryBatchInTransaction(tx, {
      branchId,
      actorId: input.actorId,
      operationId: input.operationId,
      movements: groupInventoryDeltas([{
        inventoryProductId: product.id,
        quantityDelta: delta.toString(),
        unit: product.inventoryBaseUnit,
        movementType: returning ? "EVENT_RETURN" : "EVENT_LOAD",
        sourceType: "EVENT",
        sourceId: addition.eventId,
        sourceLineId: addition.id,
        reasonCode: returning ? "EVENT_ADDITIONAL_RETURN" : "EVENT_ADDITIONAL_LOAD",
      }]),
    });
    movementId = movements[0]?.id ?? null;
  } else if (!returning) {
    await requireLegacyInventoryAvailable(
      tx, branchId, product.id, original.toNumber(), product.unit,
    );
  }

  const commercialQuantity = returning ? closed.plus(open.div(perUnit)) : original.negated();
  const entry = await tx.inventoryEntry.create({
    data: {
      branchId,
      productId: product.id,
      type: returning ? "REGRESO_EVENTO" : "SALIDA_EVENTO",
      quantity: commercialQuantity,
      notes: `Evento ${addition.eventId} · carga adicional ${addition.id} · ${returning ? "regreso" : "salida"}`,
    },
  });
  await appendAuditEvent(tx, {
    actorId: input.actorId,
    branchId,
    operationId: input.operationId,
    action: returning ? "EVENT_ADDITIONAL_SUPPLY_RETURNED" : "EVENT_ADDITIONAL_SUPPLY_LOADED",
    entityType: "EventAddedProduct",
    entityId: addition.id,
    metadata: {
      eventId: addition.eventId,
      productId: product.id,
      quantity: closed.toString(),
      openQuantity: open.toString(),
      inventoryEntryId: entry.id,
      inventoryMovementId: movementId,
    },
  });
  return movementId ?? entry.id;
}
