import "server-only";
import { Prisma, type ServiceEventItem } from "@prisma/client";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { normalizeManualInventoryQuantity, requireLegacyInventoryAvailable } from "@/lib/inventory/manualMovements";

export async function applyEventInventoryMovement(tx: Prisma.TransactionClient, input: {
  item: ServiceEventItem; branchId: string; actorId: string; operationId: string;
  eventId: string; returning: boolean;
}) {
  const { item } = input;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.branchId}:${item.productId}`},0))::text`;
  const product = await tx.inventoryProduct.findUniqueOrThrow({ where: { id: item.productId } });
  const balance = await tx.inventoryBalance.findUnique({ where: { branchId_inventoryProductId: { branchId: input.branchId, inventoryProductId: product.id } } });
  const closed = Number(input.returning ? item.returnedQuantity ?? 0 : item.sentQuantity ?? item.plannedQuantity);
  const open = input.returning ? Number(item.returnedOpenQuantity ?? 0) : 0;
  if (!closed && !open) return;
  const snapshot = { ...product, unit: item.unit, handlingUnit: item.handlingUnit, contentPerUnit: item.contentPerUnit, contentUnit: item.contentUnit, normalizedContentPerUnit: null };
  let legacyQuantity = closed;
  if (balance) {
    if (!product.inventoryBaseUnit || balance.unit !== product.inventoryBaseUnit) throw new Error("La unidad del saldo no coincide con el producto del evento.");
    const amount = normalizeManualInventoryQuantity(snapshot, closed).plus(open);
    const delta = input.returning ? amount : amount.negated();
    await applyInventoryBatchInTransaction(tx, { branchId: input.branchId, actorId: input.actorId, operationId: input.operationId,
      movements: groupInventoryDeltas([{ inventoryProductId: product.id, quantityDelta: delta.toString(), unit: product.inventoryBaseUnit,
        movementType: input.returning ? "EVENT_RETURN" : "EVENT_LOAD", sourceType: "EVENT", sourceId: input.eventId, sourceLineId: item.id,
        reasonCode: input.returning ? "EVENT_CONFIRMED_RETURN" : "EVENT_CONFIRMED_LOAD",
      }]),
    });
  }
  if (open) {
    // Remnants are captured in g/ml/pieces; legacy rows retain the item's unit.
    const factor = product.inventoryBaseUnit ? normalizeManualInventoryQuantity(snapshot, 1).toNumber()
      : Number(item.contentPerUnit ?? 0) * (["L", "KG"].includes(item.contentUnit ?? "") ? 1000 : 1);
    if (!(factor > 0)) throw new Error("La presentación del evento no permite convertir el remanente.");
    legacyQuantity += open / factor;
  }
  if (!balance && !input.returning) await requireLegacyInventoryAvailable(tx, input.branchId, product.id, legacyQuantity, item.unit);
  await tx.inventoryEntry.create({ data: { branchId: input.branchId, productId: product.id,
    type: input.returning ? "REGRESO_EVENTO" : "SALIDA_EVENTO", quantity: input.returning ? legacyQuantity : -legacyQuantity,
    notes: `Evento ${input.eventId} · ${input.returning ? "regreso confirmado" : "salida confirmada"}`,
  } });
  await appendAuditEvent(tx, { actorId: input.actorId, branchId: input.branchId, operationId: input.operationId,
    action: input.returning ? "EVENT_INVENTORY_RETURNED" : "EVENT_INVENTORY_LOADED", entityType: "ServiceEventItem", entityId: item.id,
    metadata: { eventId: input.eventId, quantity: closed, openQuantity: open, unit: item.unit },
  });
}
