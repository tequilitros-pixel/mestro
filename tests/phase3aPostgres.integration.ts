import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { consumePosInventory } from "@/lib/pos/v1InventoryGuard";
import { cancelPosSaleAtomic } from "@/lib/pos/cancelSale";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent, processNextOutboxEvent } from "@/lib/pos2/outbox";
import { evaluateCapabilityShadow } from "@/lib/pos2/capabilities";
import { evaluateCapability } from "@/lib/pos2/capabilityPolicy";
import { generateOperationId } from "@/lib/pos2/operationId";
import { hashPayload } from "@/lib/pos2/payloadHash";

const enabled = Boolean(process.env.PHASE3A_TEST_DATABASE_URL);
const prefix = "p3a1";

test("POS 2.0 phase 3A PostgreSQL contract", { skip: !enabled, timeout: 30_000 }, async (t) => {
  const userId = `${prefix}-admin`;
  const branchA = `${prefix}-branch-a`;
  const branchB = `${prefix}-branch-b`;
  const productA = `${prefix}-inventory-a`;
  const productB = `${prefix}-inventory-b`;

  await prisma.user.create({ data: { id: userId, name: "Phase 3A Admin", username: `${prefix}-admin`, password: "not-a-real-login", role: "ADMIN" } });
  await prisma.branch.createMany({ data: [
    { id: branchA, name: "Phase 3A A", code: `${prefix}-a` },
    { id: branchB, name: "Phase 3A B", code: `${prefix}-b` },
  ] });
  await prisma.inventoryProduct.createMany({ data: [
    { id: productA, code: `${prefix}-inv-a`, name: "Inventory A", category: "TEST", unit: "pz", itemType: "CONSUMABLE", trackStock: true },
    { id: productB, code: `${prefix}-inv-b`, name: "Inventory B", category: "TEST", unit: "pz", itemType: "CONSUMABLE", trackStock: true },
  ] });

  async function countStock(branchId: string, code: string, values: Array<[string, number]>) {
    const count = await prisma.inventoryCount.create({ data: { code, branchId, countDate: new Date(), status: "CERRADO" } });
    await prisma.inventoryCountItem.createMany({ data: values.map(([productId, quantityCounted]) => ({ countId: count.id, productId, quantityCounted })) });
  }

  await t.test("stock=1 serializes two concurrent consumers", async () => {
    await countStock(branchA, `${prefix}-stock-one`, [[productA, 1]]);
    const consume = (saleCode: string) => prisma.$transaction((tx) => consumePosInventory(tx, {
      branchId: branchA, saleCode, requirements: [{ productId: productA, quantity: 1 }],
    }));
    const results = await Promise.allSettled([consume(`${prefix}-stock-sale-1`), consume(`${prefix}-stock-sale-2`)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected?.reason instanceof DomainError);
    assert.equal(rejected.reason.code, "INSUFFICIENT_STOCK");
    assert.equal(await prisma.inventoryEntry.count({ where: { branchId: branchA, productId: productA, type: "VENTA_POS" } }), 1);
  });

  await t.test("multi-product ordering avoids deadlock and branches remain independent", async () => {
    await countStock(branchA, `${prefix}-multi-a`, [[productA, 10], [productB, 10]]);
    await countStock(branchB, `${prefix}-multi-b`, [[productA, 10], [productB, 10]]);
    await Promise.all([
      prisma.$transaction((tx) => consumePosInventory(tx, { branchId: branchA, saleCode: `${prefix}-multi-1`, requirements: [{ productId: productB, quantity: 1 }, { productId: productA, quantity: 1 }] })),
      prisma.$transaction((tx) => consumePosInventory(tx, { branchId: branchA, saleCode: `${prefix}-multi-2`, requirements: [{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }] })),
    ]);
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ lock: string }>>`SELECT pg_advisory_xact_lock(hashtextextended(${`${branchA}:${productA}`}, 0))::text AS "lock"`;
      await tx.$queryRaw<Array<{ slept: string }>>`SELECT pg_sleep(0.8)::text AS "slept"`;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const started = Date.now();
    await prisma.$transaction((tx) => consumePosInventory(tx, { branchId: branchB, saleCode: `${prefix}-branch-independent`, requirements: [{ productId: productA, quantity: 1 }] }));
    assert.ok(Date.now() - started < 650, "another branch must not wait on branch A's advisory lock");
    await blocker;
  });

  await t.test("sequential/concurrent idempotency and reused-key rejection", async () => {
    const sequentialId = generateOperationId();
    let sequentialExecutions = 0;
    const invokeSequential = () => executeIdempotent({ operationId: sequentialId, command: "phase3a.sequential", payload: { amount: 10 }, execute: async () => ({ type: "ok", id: `seq-${++sequentialExecutions}` }) });
    const first = await invokeSequential();
    const replay = await invokeSequential();
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(sequentialExecutions, 1);

    const concurrentId = generateOperationId();
    let concurrentExecutions = 0;
    const invokeConcurrent = () => executeIdempotent({ operationId: concurrentId, command: "phase3a.concurrent", payload: { amount: 20 }, execute: async () => {
      concurrentExecutions += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { type: "ok", id: "concurrent-result" };
    } });
    const concurrent = await Promise.all([invokeConcurrent(), invokeConcurrent()]);
    assert.equal(concurrentExecutions, 1);
    assert.deepEqual(concurrent.map((result) => result.replayed).sort(), [false, true]);
    await assert.rejects(
      executeIdempotent({ operationId: concurrentId, command: "phase3a.concurrent", payload: { amount: 21 }, execute: async () => ({ type: "bad", id: "bad" }) }),
      (error: unknown) => error instanceof DomainError && error.code === "IDEMPOTENCY_KEY_REUSED",
    );
  });

  await t.test("rollback removes receipt, audit and outbox together", async () => {
    const operationId = generateOperationId();
    await assert.rejects(executeIdempotent({ operationId, command: "phase3a.rollback", payload: { rollback: true }, execute: async (tx) => {
      await appendAuditEvent(tx, { action: "phase3a.rollback", entityType: "Test", entityId: prefix, operationId });
      await appendOutboxEvent(tx, { topic: "phase3a.rollback", aggregate: "Test", aggregateId: prefix, operationId, payload: { rollback: true } });
      throw new Error("intentional rollback");
    } }), /intentional rollback/);
    assert.equal(await prisma.operationReceipt.count({ where: { operationId } }), 0);
    assert.equal(await prisma.auditEvent.count({ where: { operationId } }), 0);
    assert.equal(await prisma.outboxEvent.count({ where: { operationId } }), 0);
  });

  await t.test("audit is append-only", async () => {
    const event = await prisma.auditEvent.create({ data: { id: `${prefix}-immutable-audit`, action: "phase3a.audit", entityType: "Test", entityId: prefix } });
    await assert.rejects(prisma.auditEvent.update({ where: { id: event.id }, data: { action: "changed" } }), /append-only/);
    await assert.rejects(prisma.auditEvent.delete({ where: { id: event.id } }), /append-only/);
    assert.equal((await prisma.auditEvent.findUniqueOrThrow({ where: { id: event.id } })).action, "phase3a.audit");
  });

  await t.test("outbox is transactional and two SKIP LOCKED consumers claim distinct events", async () => {
    await prisma.outboxEvent.createMany({ data: [
      { id: `${prefix}-outbox-1`, topic: "phase3a.outbox", aggregate: "Test", aggregateId: "1", payload: { n: 1 } },
      { id: `${prefix}-outbox-2`, topic: "phase3a.outbox", aggregate: "Test", aggregateId: "2", payload: { n: 2 } },
    ] });
    const claimed: string[] = [];
    await Promise.all([
      processNextOutboxEvent(async (event) => { claimed.push(event.id); await new Promise((resolve) => setTimeout(resolve, 100)); }),
      processNextOutboxEvent(async (event) => { claimed.push(event.id); await new Promise((resolve) => setTimeout(resolve, 100)); }),
    ]);
    assert.equal(new Set(claimed).size, 2);
    assert.equal(await prisma.outboxEvent.count({ where: { id: { in: claimed }, status: "PROCESSED", attempts: 1 } }), 2);
  });

  await t.test("capability scopes and shadow mismatch auditing", async () => {
    const actor = { id: userId, role: "ADMIN" as const, branchIds: [branchA] };
    const base = { capabilityKey: "pos.sale.cancel", role: null, userId, branchId: null };
    assert.equal(evaluateCapability(actor, "pos.sale.cancel", undefined, [{ ...base, scope: "SELF" }]), true);
    assert.equal(evaluateCapability(actor, "pos.sale.cancel", branchA, [{ ...base, scope: "BRANCH", branchId: branchA }]), true);
    assert.equal(evaluateCapability(actor, "pos.sale.cancel", branchB, [{ ...base, scope: "MULTI_BRANCH" }]), false);
    assert.equal(evaluateCapability(actor, "pos.sale.cancel", branchB, [{ ...base, scope: "GLOBAL" }]), true);
    const result = await prisma.$transaction((tx) => evaluateCapabilityShadow(tx, { actor, capability: "pos.sale.cancel", branchId: branchA, legacyAllowed: true, entityType: "Test", entityId: `${prefix}-shadow` }));
    assert.deepEqual(result, { legacyAllowed: true, shadowAllowed: false });
    assert.equal(await prisma.auditEvent.count({ where: { action: "capability.shadow_mismatch", entityId: `${prefix}-shadow` } }), 1);
    await assert.rejects(prisma.capabilityGrant.create({ data: { capabilityId: "cap-pos-sale-cancel", userId, scope: "BRANCH" } }), /CapabilityGrant_scope_check/);
  });

  await t.test("nullable legacy clientPayloadHash and hashed new sale coexist", async () => {
    const cashCut = await prisma.cashCut.create({ data: { id: `${prefix}-cut-hash`, code: `${prefix}-cut-hash`, branchId: branchA, responsibleId: userId, date: new Date(), startingFund: 0, createdById: userId } });
    const legacy = await prisma.posSale.create({ data: { id: `${prefix}-legacy-sale`, code: `${prefix}-legacy-sale`, branchId: branchA, cashCutId: cashCut.id, soldById: userId, subtotal: 0, total: 0 } });
    const hash = hashPayload({ total: 1 });
    const current = await prisma.posSale.create({ data: { id: `${prefix}-hashed-sale`, code: `${prefix}-hashed-sale`, clientPayloadHash: hash, branchId: branchA, cashCutId: cashCut.id, soldById: userId, subtotal: 1, total: 1 } });
    assert.equal(legacy.clientPayloadHash, null);
    assert.equal(current.clientPayloadHash, hash);
  });

  await t.test("double cancel reverses inventory and cash exactly once", async () => {
    const category = await prisma.posCategory.create({ data: { id: `${prefix}-category`, name: "Phase 3A" } });
    const product = await prisma.posProduct.create({ data: { id: `${prefix}-pos-product`, categoryId: category.id, name: "Phase 3A Product" } });
    const variant = await prisma.posProductVariant.create({ data: { id: `${prefix}-variant`, productId: product.id, name: "Único", price: 100 } });
    await prisma.posVariantIngredient.create({ data: { id: `${prefix}-ingredient`, variantId: variant.id, inventoryProductId: productB, quantity: new Prisma.Decimal(2) } });
    const cashCut = await prisma.cashCut.create({ data: { id: `${prefix}-cut-cancel`, code: `${prefix}-cut-cancel`, branchId: branchA, responsibleId: userId, date: new Date(), startingFund: 0, createdById: userId } });
    await prisma.cashSalePayment.create({ data: { cashCutId: cashCut.id, method: "EFECTIVO", amount: 100 } });
    const sale = await prisma.posSale.create({ data: {
      id: `${prefix}-cancel-sale`, code: `${prefix}-cancel-sale`, branchId: branchA, cashCutId: cashCut.id, soldById: userId, subtotal: 100, total: 100,
      items: { create: { id: `${prefix}-cancel-item`, variantId: variant.id, name: "Phase 3A Product", unitPrice: 100, quantity: 1, lineTotal: 100 } },
      payments: { create: { id: `${prefix}-cancel-payment`, method: "EFECTIVO", amount: 100 } },
    } });
    const attempts = await Promise.all([
      cancelPosSaleAtomic({ saleId: sale.id, user: { id: userId, role: "ADMIN" }, reason: "test", operationId: generateOperationId() }),
      cancelPosSaleAtomic({ saleId: sale.id, user: { id: userId, role: "ADMIN" }, reason: "test", operationId: generateOperationId() }),
    ]);
    assert.deepEqual(attempts.map((attempt) => attempt.kind).sort(), ["cancelled", "duplicate"]);
    assert.equal(await prisma.inventoryEntry.count({ where: { branchId: branchA, productId: productB, type: "DEVOLUCION_POS", notes: { contains: sale.code } } }), 1);
    assert.equal((await prisma.cashSalePayment.findUniqueOrThrow({ where: { cashCutId_method: { cashCutId: cashCut.id, method: "EFECTIVO" } } })).amount, 0);
    assert.equal(await prisma.auditEvent.count({ where: { action: "pos.sale.cancelled", entityId: sale.id } }), 1);
    assert.equal(await prisma.outboxEvent.count({ where: { topic: "pos.sale.cancelled", aggregateId: sale.id } }), 1);
  });

  await prisma.$disconnect();
});
