import "server-only";
import { Prisma, type InventoryProduct, type InventoryEntryType } from "@prisma/client";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { generateOperationId } from "@/lib/pos2/operationId";
import { applyInventoryBatchInTransaction } from "@/lib/pos2/inventory/applyMovements";
import { groupInventoryDeltas } from "@/lib/pos2/inventory/domain";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { getNormalizedContentPerUnit } from "@/lib/inventory/units";

export function normalizeManualInventoryQuantity(product: InventoryProduct, quantity: number) {
  const label = product.unit.trim().toLocaleLowerCase("es-MX");
  const direct = product.inventoryBaseUnit === "UNIT" && ["unit", "pza", "pieza", "piezas", "unidad", "unidades"].includes(label)
    || product.inventoryBaseUnit === "G" && ["g", "gr", "gramo", "gramos"].includes(label)
    || product.inventoryBaseUnit === "ML" && ["ml", "mililitro", "mililitros"].includes(label);
  if (direct) return new Prisma.Decimal(quantity);
  if (product.inventoryBaseUnit === "G" && ["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(label)
    || product.inventoryBaseUnit === "ML" && ["l", "lt", "litro", "litros"].includes(label)) return new Prisma.Decimal(quantity).times(1000);
  const factor = getNormalizedContentPerUnit(product);
  if (factor !== null && label === product.handlingUnit?.toLocaleLowerCase("es-MX")) return new Prisma.Decimal(quantity).times(factor);
  throw new Error("Configura la conversión de la presentación antes de registrar este movimiento.");
}

export async function requireLegacyInventoryAvailable(tx: Prisma.TransactionClient, branchId: string, productId: string, outgoing: number, unit: string) {
  const count = await tx.inventoryCount.findFirst({ where: { branchId, status: "CERRADO", items: { some: { productId } } }, orderBy: [{ countDate: "desc" }, { id: "desc" }], include: { items: { where: { productId } } } });
  const changes = await tx.inventoryEntry.aggregate({ where: { branchId, productId, entryDate: { gt: count?.countDate ?? new Date(0) } }, _sum: { quantity: true } });
  const available = new Prisma.Decimal(count?.items[0]?.quantityCounted ?? 0).plus(changes._sum.quantity ?? 0);
  if (available.minus(outgoing).isNegative()) throw new Error(`Existencia insuficiente: disponible ${available} ${unit}.`);
}

/** Called only after module and branch authorization. Keep legacy history and the
 * authoritative V2 balance in the same transaction; never initialize a balance
 * from an invented stock value or silently transfer across different ledgers. */
export async function recordManualInventoryMovement(input: {
  actorId: string; operationId?: string; productId: string; branchId: string;
  toBranchId?: string; type: InventoryEntryType; quantity: number;
  notes: string | null; unitCost?: number | null;
}) {
  const operationId = input.operationId || generateOperationId();
  return executeIdempotent({ operationId, command: "RecordManualInventoryMovement",
    payload: { ...input, operationId: undefined }, receiptContext: { actorId: input.actorId, branchId: input.branchId },
    execute: async (tx) => {
      // Serialize manual writes and prevent a count's first balance from appearing
      // between deciding which ledger to use and recording the movement.
      await tx.$queryRaw`SELECT "id" FROM "InventoryProduct" WHERE "id"=${input.productId} FOR UPDATE`;
      const product = await tx.inventoryProduct.findUnique({ where: { id: input.productId } });
      if (!product?.isActive || product.archivedAt || !product.trackStock) throw new Error("Producto no disponible para inventario.");
      const branches = [input.branchId, ...(input.toBranchId ? [input.toBranchId] : [])].sort();
      for (const branch of branches) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${branch}:${product.id}`},0))::text`;
      const balances = await tx.inventoryBalance.findMany({ where: { inventoryProductId: product.id, branchId: { in: branches } } });
      if (input.toBranchId && balances.length === 1) throw new Error("Registra el conteo inicial del producto en ambas sucursales antes de traspasar.");
      const entries = [];
      for (const branch of branches) {
        const outgoing = Boolean(input.toBranchId && branch === input.branchId);
        const quantity = outgoing ? -input.quantity : input.quantity;
        const balance = balances.find((item) => item.branchId === branch);
        if (balance) {
          if (!product.inventoryBaseUnit || balance.unit !== product.inventoryBaseUnit) throw new Error("La unidad del saldo no coincide con el producto.");
          const delta = normalizeManualInventoryQuantity(product, quantity);
          await applyInventoryBatchInTransaction(tx, { branchId: branch, actorId: input.actorId, operationId,
            movements: groupInventoryDeltas([{ inventoryProductId: product.id, quantityDelta: delta.toString(), unit: product.inventoryBaseUnit,
              movementType: input.toBranchId ? outgoing ? "TRANSFER_OUT" : "TRANSFER_IN" : input.type === "COMPRA" ? "RECEIPT" : delta.isNegative() ? "ADJUSTMENT_OUT" : "ADJUSTMENT_IN",
              sourceType: input.toBranchId ? "TRANSFER" : input.type === "COMPRA" ? "RECEIPT" : "MANUAL_ADJUSTMENT",
              sourceId: operationId, reasonCode: input.notes ?? input.type,
              metadata: { capturedQuantity: quantity, capturedUnit: product.unit, unitCost: input.unitCost ?? null },
            }]),
          });
        } else if (quantity < 0) {
          await requireLegacyInventoryAvailable(tx, branch, product.id, -quantity, product.unit);
        }
        const entry = await tx.inventoryEntry.create({ data: { branchId: branch, productId: product.id, type: input.type, quantity, unitCost: input.unitCost,
          notes: input.toBranchId ? `Traspaso ${outgoing ? "a" : "desde"} ${outgoing ? input.toBranchId : input.branchId}${input.notes ? `: ${input.notes}` : ""}` : input.notes,
        } });
        entries.push(entry.id);
      }
      await appendAuditEvent(tx, { actorId: input.actorId, branchId: input.branchId, operationId, action: "MANUAL_INVENTORY_MOVEMENT", entityType: "InventoryEntry", entityId: entries[0], metadata: { productId: product.id, toBranchId: input.toBranchId ?? null, entries } });
      return { type: "InventoryEntry", id: entries[0], entries };
    },
  });
}
