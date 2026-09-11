import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withDatabaseActor } from "@/lib/database-context";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { reconcileWeeklyCountCutover } from "@/lib/inventory/weeklyCountCutover";
import { isBranchAllowed } from "@/lib/branches/access";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";
import { getBranchInventory } from "@/lib/pos2/inventory/queries";

const id = (value: string) => `4${value.padStart(7, "0")}-0000-7000-8000-000000000000`;
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.OWNER_DATABASE_URL! }) });

test("FASE 4L: cutover autoritativo, replay, rollback, locking y vasos legacy", async () => {
  const suffix = Date.now().toString();
  const branchId = `4l-branch-${suffix}`;
  const otherBranchId = `4l-other-${suffix}`;
  const adminId = `4l-admin-${suffix}`;
  const productId = `4l-product-${suffix}`;
  const vasoGrandeId = `4l-large-${suffix}`;
  const vasoMedianoId = `4l-medium-${suffix}`;
  const vasosLegacyId = `4l-legacy-${suffix}`;
  const countId = `4l-count-${suffix}`;
  const actor = { id: adminId, role: "ADMIN" as const };

  await owner.$transaction(async (tx) => {
    await tx.branch.createMany({ data: [{ id: branchId, name: "4L Branch", code: `4L${suffix}` }, { id: otherBranchId, name: "4L Other", code: `4O${suffix}` }] });
    await tx.user.create({ data: { id: adminId, name: "4L Admin", username: `4l-${suffix}`, password: "fixture", role: "ADMIN" } });
    const capability = await tx.capability.upsert({ where: { key: "inventory.view" }, create: { key: "inventory.view", description: "4L test inventory read" }, update: {} });
    await tx.capabilityGrant.create({ data: { capabilityId: capability.id, role: "ADMIN", scope: "GLOBAL" } });
    await tx.inventoryProduct.createMany({ data: [
      { id: productId, code: `4L-P-${suffix}`, name: "4L Product", category: "TEST", unit: "Pza", itemType: "CONSUMABLE", trackStock: true, inventoryBaseUnit: "UNIT" },
      { id: vasoGrandeId, code: `4L-G-${suffix}`, name: "Vaso grande", category: "TEST", unit: "Pza", itemType: "CONSUMABLE", trackStock: true, inventoryBaseUnit: "UNIT", handlingUnit: "PAQUETE", contentPerUnit: 25, contentUnit: "PIEZAS", normalizedContentPerUnit: 25 },
      { id: vasoMedianoId, code: `4L-M-${suffix}`, name: "Vaso mediano", category: "TEST", unit: "Pza", itemType: "CONSUMABLE", trackStock: true, inventoryBaseUnit: "UNIT", handlingUnit: "PAQUETE", contentPerUnit: 25, contentUnit: "PIEZAS", normalizedContentPerUnit: 25 },
      { id: vasosLegacyId, code: `4L-V-${suffix}`, name: "VASOS", category: "TEST", unit: "Pza", itemType: "CONSUMABLE", trackStock: true, inventoryBaseUnit: null, isActive: false },
    ] });
    await tx.inventoryBalance.create({ data: { branchId, inventoryProductId: productId, quantity: 167, unit: "UNIT" } });
    await tx.inventoryCount.create({ data: { id: countId, code: `4L-C-${suffix}`, branchId, countDate: new Date(), items: { create: [
      { productId, quantityCounted: 120, previousQuantity: 167 },
      { productId: vasoGrandeId, quantityCounted: 10 },
      { productId: vasoMedianoId, quantityCounted: 8 },
      { productId: vasosLegacyId, quantityCounted: 25 },
    ] } } });
  });

  const operationId = id(suffix.slice(-7));
  const run = (operationId: string, targetCountId: string, extra?: { failAfterProductId?: string }) => withDatabaseActor(actor, () => executeIdempotent({ operationId, command: "CloseInventoryCountV2", payload: { countId: targetCountId, ...extra }, receiptContext: { actorId: adminId, branchId }, execute: (tx) => reconcileWeeklyCountCutover(tx, { countId: targetCountId, actorId: adminId, operationId, ...extra }) }));
  const first = await run(operationId, countId);
  assert.equal(first.replayed, false);
  assert.equal((await owner.inventoryBalance.findUniqueOrThrow({ where: { branchId_inventoryProductId: { branchId, inventoryProductId: productId } } })).quantity.toString(), "120");
  assert.equal(await owner.inventoryMovement.count({ where: { operationId } }), 3);
  assert.equal(await owner.auditEvent.count({ where: { operationId } }), 1);

  const replay = await run(operationId, countId);
  assert.equal(replay.replayed, true);
  assert.equal((await owner.inventoryBalance.findUniqueOrThrow({ where: { branchId_inventoryProductId: { branchId, inventoryProductId: productId } } })).quantity.toString(), "120");
  assert.equal(await owner.inventoryMovement.count({ where: { operationId } }), 3);

  const rollbackCountId = `4l-rollback-${suffix}`;
  const rollbackOp = id(`${suffix.slice(-6)}1`);
  await owner.inventoryCount.create({ data: { id: rollbackCountId, code: `4L-R-${suffix}`, branchId, countDate: new Date(), items: { create: { productId, quantityCounted: 111 } } } });
  await assert.rejects(run(rollbackOp, rollbackCountId, { failAfterProductId: productId }));
  assert.equal((await owner.inventoryCount.findUniqueOrThrow({ where: { id: rollbackCountId } })).status, "BORRADOR");
  assert.equal((await owner.inventoryBalance.findUniqueOrThrow({ where: { branchId_inventoryProductId: { branchId, inventoryProductId: productId } } })).quantity.toString(), "120");
  assert.equal(await owner.operationReceipt.count({ where: { operationId: rollbackOp } }), 0);

  const concurrentCountId = `4l-concurrent-${suffix}`;
  const concurrentOpA = id(`${suffix.slice(-6)}2`);
  const concurrentOpB = id(`${suffix.slice(-6)}3`);
  await owner.inventoryCount.create({ data: { id: concurrentCountId, code: `4L-N-${suffix}`, branchId, countDate: new Date(), items: { create: { productId, quantityCounted: 100 } } } });
  const results = await Promise.allSettled([concurrentOpA, concurrentOpB].map((operationId) => run(operationId, concurrentCountId)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await owner.inventoryBalance.findUniqueOrThrow({ where: { branchId_inventoryProductId: { branchId, inventoryProductId: productId } } })).quantity.toString(), "100");
  assert.equal(await owner.inventoryMovement.count({ where: { sourceId: concurrentCountId } }), 1);

  assert.equal(isBranchAllowed([branchId], branchId), true);
  assert.equal(isBranchAllowed([branchId], otherBranchId), false);
  assert.equal(canViewInventoryCountSystemData("GERENTE"), false);
  assert.equal(canViewInventoryCountSystemData("ADMIN"), true);
  assert.equal(await owner.inventoryMovement.count({ where: { inventoryProductId: vasosLegacyId } }), 0);
  assert.equal((await owner.inventoryBalance.findUniqueOrThrow({ where: { branchId_inventoryProductId: { branchId, inventoryProductId: productId } } })).quantity.toString(), "100");
  const pos2Actor = { ...actor, branchIds: null };
  const pos2Balances = await withDatabaseActor(pos2Actor, () => getBranchInventory(pos2Actor, branchId));
  assert.equal(pos2Balances.find((balance) => balance.inventoryProductId === productId)?.quantity.toString(), "100");

  // The integration database is disposable. Append-only ledger triggers
  // intentionally prevent cleanup deletes; the container is discarded after
  // the run instead of weakening production invariants for test cleanup.
});
