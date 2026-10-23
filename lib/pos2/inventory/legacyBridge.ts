import "server-only";
import { Prisma } from "@prisma/client";
import type { CatalogBaseUnit } from "@prisma/client";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { DomainError } from "@/lib/domain/errors";
import { getLegacyBalance } from "./queries";
import { applyInventoryMovementsBatch } from "./applyMovements";
import type { CommandActor } from "@/lib/pos2/authorization";

export async function backfillLegacyOpeningBalanceDev(i: { branchId: string; inventoryProductId: string; unit: CatalogBaseUnit; actor: CommandActor; operationId: string; capturedAt: Date; migrationVersion: string }) {
  if (process.env.NODE_ENV === "production") throw new Error("Legacy Inventory V2 backfill is disabled in production");
  const legacy = await getLegacyBalance(i.branchId, i.inventoryProductId); if (legacy.isZero()) return { skipped: true, legacyBalance: "0.000000" };
  const outcome = await applyInventoryMovementsBatch({ branchId: i.branchId, actor: i.actor, operationId: i.operationId, capability: "inventory.adjust", auditAction: "INVENTORY_LEGACY_OPENING_CAPTURED", movements: [{ inventoryProductId: i.inventoryProductId, quantityDelta: legacy.toString(), unit: i.unit, movementType: "OPENING_BALANCE", sourceType: "LEGACY_OPENING", sourceId: i.migrationVersion, reasonCode: "LEGACY_AUTHORIZED_BALANCE", metadata: { legacySource: "latest CLOSED InventoryCount + InventoryEntry after count", capturedAt: i.capturedAt.toISOString(), migrationVersion: i.migrationVersion } }] }); return { skipped: false, legacyBalance: legacy.toFixed(6), outcome };
}

export async function backfillLegacyOpeningBalanceForCompleteSale(input: {
  tx: Prisma.TransactionClient;
  branchId: string;
  actor: CommandActor;
  operationId: string;
  capturedAt: Date;
  migrationVersion: string;
  movements: Array<{ inventoryProductId: string; unit: CatalogBaseUnit }>;
}) {
  const requested = new Map<string, CatalogBaseUnit>();
  for (const movement of input.movements) {
    if (!requested.has(movement.inventoryProductId)) requested.set(movement.inventoryProductId, movement.unit);
  }

  const toSync = [] as Array<{ inventoryProductId: string; unit: CatalogBaseUnit }>;
  if (!requested.size) return { synced: [], skipped: [] as string[] };

  const existingBalances = await input.tx.inventoryBalance.findMany({
    where: {
      branchId: input.branchId,
      inventoryProductId: { in: [...requested.keys()] },
    },
    select: { id: true, inventoryProductId: true, quantity: true, unit: true },
  });
  const existingBalanceByProductId = new Map(existingBalances.map((item) => [item.inventoryProductId, item]));

  for (const [inventoryProductId, unit] of requested.entries()) {
    const existing = existingBalanceByProductId.get(inventoryProductId);
    if (existing) {
      if (existing.unit !== unit) throw new DomainError("INVENTORY_UNIT_MISMATCH", { inventoryProductId, expected: existing.unit, received: unit });
      const firstMovement = await input.tx.inventoryMovement.findFirst({
        where: { branchId: input.branchId, inventoryProductId },
        select: { id: true },
      });
      if (firstMovement || !existing.quantity.isZero()) continue;
    }
    toSync.push({ inventoryProductId, unit });
  }

  const synced = [] as Array<{ inventoryProductId: string; legacyBalance: string }>;
  for (const item of toSync) {
    const legacy = await getLegacyBalance(input.branchId, item.inventoryProductId);
    if (legacy.isNegative()) {
      throw new DomainError("INVENTORY_BALANCE_MISMATCH", { inventoryProductId: item.inventoryProductId, legacyBalance: legacy.toFixed(6), branchId: input.branchId, reason: "Legacy balance is negative and cannot be synchronized." });
    }

    const before = new Prisma.Decimal(0);
    const after = legacy;
    const sourceId = `${input.migrationVersion}:${input.operationId}:${item.inventoryProductId}`;
    try {
      const existing = existingBalanceByProductId.get(item.inventoryProductId);
      if (existing) {
        await input.tx.inventoryBalance.update({
          where: { id: existing.id },
          data: { quantity: legacy, unit: item.unit, version: { increment: 1 } },
        });
      } else {
        await input.tx.inventoryBalance.create({
          data: {
            branchId: input.branchId,
            inventoryProductId: item.inventoryProductId,
            quantity: legacy,
            unit: item.unit,
            version: 1,
          },
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await input.tx.inventoryBalance.findUnique({
          where: { branchId_inventoryProductId: { branchId: input.branchId, inventoryProductId: item.inventoryProductId } },
          select: { unit: true },
        });
        if (current?.unit && current.unit !== item.unit) {
          throw new DomainError("INVENTORY_UNIT_MISMATCH", { inventoryProductId: item.inventoryProductId, expected: current.unit, received: item.unit });
        }
        continue;
      }
      throw error;
    }

    await input.tx.inventoryMovement.create({
      data: {
        branchId: input.branchId,
        inventoryProductId: item.inventoryProductId,
        movementType: "OPENING_BALANCE",
        quantityDelta: legacy,
        unit: item.unit,
        balanceBefore: before,
        balanceAfter: after,
        sourceType: "LEGACY_OPENING",
        sourceId,
        actorId: input.actor.id,
        operationId: input.operationId,
        reasonCode: "LEGACY_AUTHORIZED_BALANCE",
        metadata: {
          migrationVersion: input.migrationVersion,
          capturedAt: input.capturedAt.toISOString(),
          legacyBalance: legacy.toFixed(6),
          source: "completeSale-bootstrap",
        },
      },
    });

    await appendAuditEvent(input.tx, {
      actorId: input.actor.id,
      branchId: input.branchId,
      action: "INVENTORY_LEGACY_OPENING_CAPTURED",
      entityType: "InventoryMovement",
      entityId: sourceId,
      operationId: input.operationId,
      metadata: {
        inventoryProductId: item.inventoryProductId,
        unit: item.unit,
        before: before.toFixed(6),
        after: after.toFixed(6),
        legacyBalance: legacy.toFixed(6),
      },
    });
    await appendOutboxEvent(input.tx, {
      topic: "inventory.movements.legacy_opening_applied",
      aggregate: "InventoryBalance",
      aggregateId: item.inventoryProductId,
      operationId: input.operationId,
      payload: {
        inventoryProductId: item.inventoryProductId,
        branchId: input.branchId,
        before: before.toFixed(6),
        after: after.toFixed(6),
        legacyBalance: legacy.toFixed(6),
      },
    });

    synced.push({ inventoryProductId: item.inventoryProductId, legacyBalance: legacy.toFixed(6) });
  }

  return { synced, skipped: toSync.map((item) => item.inventoryProductId).filter((id) => !synced.some((entry) => entry.inventoryProductId === id)) };
}

export async function compareLegacyToV2(branchId: string, inventoryProductId: string, v2Quantity: string) { const legacy = await getLegacyBalance(branchId, inventoryProductId); return { legacy: legacy.toFixed(6), v2: v2Quantity, status: legacy.equals(v2Quantity) ? "MATCH" as const : "MISMATCH" as const }; }
