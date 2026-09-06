import "server-only";
import type { CatalogBaseUnit } from "@prisma/client";
import { getLegacyBalance } from "./queries";
import { applyInventoryMovementsBatch } from "./applyMovements";
import type { CommandActor } from "@/lib/pos2/authorization";

export async function backfillLegacyOpeningBalanceDev(i: { branchId: string; inventoryProductId: string; unit: CatalogBaseUnit; actor: CommandActor; operationId: string; capturedAt: Date; migrationVersion: string }) {
  if (process.env.NODE_ENV === "production") throw new Error("Legacy Inventory V2 backfill is disabled in production");
  const legacy = await getLegacyBalance(i.branchId, i.inventoryProductId); if (legacy.isZero()) return { skipped: true, legacyBalance: "0.000000" };
  const outcome = await applyInventoryMovementsBatch({ branchId: i.branchId, actor: i.actor, operationId: i.operationId, capability: "inventory.adjust", auditAction: "INVENTORY_LEGACY_OPENING_CAPTURED", movements: [{ inventoryProductId: i.inventoryProductId, quantityDelta: legacy.toString(), unit: i.unit, movementType: "OPENING_BALANCE", sourceType: "LEGACY_OPENING", sourceId: i.migrationVersion, reasonCode: "LEGACY_AUTHORIZED_BALANCE", metadata: { legacySource: "latest CLOSED InventoryCount + InventoryEntry after count", capturedAt: i.capturedAt.toISOString(), migrationVersion: i.migrationVersion } }] }); return { skipped: false, legacyBalance: legacy.toFixed(6), outcome };
}

export async function compareLegacyToV2(branchId: string, inventoryProductId: string, v2Quantity: string) { const legacy = await getLegacyBalance(branchId, inventoryProductId); return { legacy: legacy.toFixed(6), v2: v2Quantity, status: legacy.equals(v2Quantity) ? "MATCH" as const : "MISMATCH" as const }; }
