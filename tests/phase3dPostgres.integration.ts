import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { generateOperationId } from "@/lib/pos2/operationId";
import { createPriceVersion, endPriceVersion } from "@/lib/pos2/pricing/managePrices";
import { resolvePrice, resolvePricesBatch } from "@/lib/pos2/pricing/resolvePrice";
import { validateLegacyPriceShadow } from "@/lib/pos2/pricing/shadow";

const enabled = Boolean(process.env.PHASE3D_TEST_DATABASE_URL);

test("POS 2.0 phase 3D PostgreSQL contract", { skip: !enabled, timeout: 120_000 }, async (t) => {
  const p = "p3d"; const adminId = `${p}-admin`; const branchA = `${p}-a`; const branchB = `${p}-b`; const productId = `${p}-product`; const variantId = `${p}-variant`;
  const admin = { id: adminId, role: "ADMIN" as const, branchIds: null };
  await prisma.user.create({ data: { id: adminId, name: "Pricing Admin", username: adminId, password: "test-only", role: "ADMIN" } });
  await prisma.branch.createMany({ data: [{ id: branchA, name: "Pricing A", code: branchA }, { id: branchB, name: "Pricing B", code: branchB }] });
  await prisma.posCategory.create({ data: { id: `${p}-category`, name: "Pricing" } });
  await prisma.posProduct.create({ data: { id: productId, categoryId: `${p}-category`, name: "Cantarito", active: true } });
  await prisma.posProductVariant.create({ data: { id: variantId, productId, name: "Grande", price: 100, active: true } });
  const start = new Date("2026-01-01T00:00:00Z"); const change = new Date("2027-01-01T00:00:00Z");

  await t.test("global, branch override and exact boundary resolve deterministically", async () => {
    const operationId = generateOperationId();
    const created = await createPriceVersion({ operationId, actor: admin, variantId, scope: "GLOBAL", amount: "99", validFrom: start, validTo: change });
    assert.equal((await createPriceVersion({ operationId, actor: admin, variantId, scope: "GLOBAL", amount: "99", validFrom: start, validTo: change })).replayed, true);
    await createPriceVersion({ operationId: generateOperationId(), actor: admin, variantId, scope: "GLOBAL", amount: "105", validFrom: change });
    await createPriceVersion({ operationId: generateOperationId(), actor: admin, variantId, scope: "BRANCH", branchId: branchA, amount: "95", validFrom: start });
    assert.equal(created.result.amount, "99.00");
    assert.equal((await resolvePrice({ variantId, branchId: branchA, at: new Date("2026-06-01Z") })).amount, "95.00");
    assert.equal((await resolvePrice({ variantId, branchId: branchB, at: new Date("2026-06-01Z") })).amount, "99.00");
    assert.equal((await resolvePrice({ variantId, branchId: branchB, at: change })).amount, "105.00");
  });

  await t.test("missing target produces PRICE_NOT_CONFIGURED instead of zero", async () => {
    await assert.rejects(resolvePrice({ productId, branchId: branchA, at: start }), (error: unknown) => error instanceof DomainError && error.code === "PRICE_NOT_CONFIGURED");
  });

  await t.test("concurrent overlapping publication admits exactly one", async () => {
    const variant = await prisma.posProductVariant.create({ data: { id: `${p}-race-v`, productId, name: "Race", price: 1 } });
    const publish = (amount: string) => createPriceVersion({ operationId: generateOperationId(), actor: admin, variantId: variant.id, scope: "GLOBAL", amount, validFrom: start });
    const results = await Promise.allSettled([publish("10"), publish("11")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected?.reason instanceof DomainError); assert.equal(rejected.reason.code, "CONFLICT");
  });

  await t.test("published rows and terminations are append-only", async () => {
    const current = await prisma.priceVersion.findFirstOrThrow({ where: { variantId, scope: "BRANCH", branchId: branchA } });
    const ended = await endPriceVersion({ operationId: generateOperationId(), actor: admin, priceVersionId: current.id, effectiveAt: change, reason: "Cambio de temporada" });
    assert.equal(ended.result.priceVersionId, current.id);
    await assert.rejects(prisma.priceVersion.update({ where: { id: current.id }, data: { amount: "1" } }));
    assert.equal((await resolvePrice({ variantId, branchId: branchA, at: change })).amount, "105.00");
    assert.equal(await prisma.auditEvent.count({ where: { entityId: current.id, action: "pricing.version.ended" } }), 1);
  });

  await t.test("branch-only grants cannot publish globally or in another branch", async () => {
    const managerId = `${p}-manager`; await prisma.user.create({ data: { id: managerId, name: "Manager", username: managerId, password: "test", role: "GERENTE" } });
    for (const capabilityId of ["cap-pricing-create", "cap-pricing-branch-override"]) await prisma.capabilityGrant.create({ data: { capabilityId, userId: managerId, scope: "BRANCH", branchId: branchA } });
    const manager = { id: managerId, role: "GERENTE" as const, branchIds: [branchA] };
    const variant = await prisma.posProductVariant.create({ data: { id: `${p}-permission-v`, productId, name: "Permission", price: 1 } });
    await createPriceVersion({ operationId: generateOperationId(), actor: manager, variantId: variant.id, scope: "BRANCH", branchId: branchA, amount: "2", validFrom: start });
    await assert.rejects(createPriceVersion({ operationId: generateOperationId(), actor: manager, variantId: variant.id, scope: "GLOBAL", amount: "2", validFrom: start }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
    await assert.rejects(createPriceVersion({ operationId: generateOperationId(), actor: manager, variantId: variant.id, scope: "BRANCH", branchId: branchB, amount: "2", validFrom: start }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
  });

  await t.test("shadow comparison records discrepancies without changing V1", async () => {
    const shadow = await validateLegacyPriceShadow({ variantId, branchId: branchB, at: new Date("2026-06-01Z"), actorId: adminId });
    assert.equal(shadow.matches, false); assert.equal(shadow.legacyAmount, "100.00"); assert.equal(shadow.v2Amount, "99.00");
    assert.equal((await prisma.posProductVariant.findUniqueOrThrow({ where: { id: variantId } })).price, 100);
    assert.equal(await prisma.auditEvent.count({ where: { action: "pricing.shadow_mismatch", entityId: variantId } }), 1);
  });

  await t.test("one batch query resolves a DEV-scale price set", async () => {
    const count = 2000;
    const variants = Array.from({ length: count }, (_, index) => ({ id: `${p}-perf-v-${index}`, productId, name: `Perf ${index}`, price: 20 }));
    await prisma.posProductVariant.createMany({ data: variants });
    await prisma.priceVersion.createMany({ data: variants.map((variant, index) => ({ id: `${p}-perf-price-${index}`, targetType: "VARIANT", targetKey: `VARIANT:${variant.id}`, variantId: variant.id, scope: "GLOBAL", branchKey: "GLOBAL", amount: "20.00", validFrom: start, createdById: adminId, operationId: generateOperationId() })) });
    const started = performance.now();
    const resolved = await resolvePricesBatch(variants.map((variant) => ({ variantId: variant.id, branchId: branchA, at: new Date("2026-06-01Z") })));
    const elapsed = performance.now() - started;
    assert.equal(resolved.filter(Boolean).length, count); assert.ok(elapsed < 5000, `batch took ${elapsed.toFixed(1)}ms`);
    t.diagnostic(`DEV batch resolver: ${elapsed.toFixed(1)}ms for ${count.toLocaleString()} variants`);
  });
  await prisma.$disconnect();
});
