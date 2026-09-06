import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { generateOperationId } from "@/lib/pos2/operationId";
import { createCatalogCategory, createCatalogProduct, createCatalogVariant, updateCatalogProduct, archiveCatalogProduct } from "@/lib/pos2/catalog/manageCatalog";
import { setBranchProductOverride } from "@/lib/pos2/catalog/manageBranchOverride";
import { resolveBranchCatalog } from "@/lib/pos2/catalog/resolveBranchCatalog";

const enabled = Boolean(process.env.PHASE3C_TEST_DATABASE_URL);

test("POS 2.0 phase 3C PostgreSQL contract", { skip: !enabled, timeout: 60_000 }, async (t) => {
  const prefix = "p3c";
  const adminId = `${prefix}-admin`;
  const branchA = `${prefix}-branch-a`;
  const branchB = `${prefix}-branch-b`;
  const admin = { id: adminId, role: "ADMIN" as const, branchIds: null };
  await prisma.user.create({ data: { id: adminId, name: "Phase 3C Admin", username: `${prefix}-admin`, password: "not-a-login", role: "ADMIN" } });
  await prisma.branch.createMany({ data: [{ id: branchA, name: "Catalog A", code: `${prefix}-a` }, { id: branchB, name: "Catalog B", code: `${prefix}-b` }] });

  let categoryId = "";
  let productId = "";
  let variantId = "";

  await t.test("category, product and variant creation are idempotent", async () => {
    const categoryOperation = generateOperationId();
    const category = await createCatalogCategory({ operationId: categoryOperation, actor: admin, name: "Bebidas frías", slug: "bebidas-frias" });
    const replay = await createCatalogCategory({ operationId: categoryOperation, actor: admin, name: "Bebidas frías", slug: "bebidas-frias" });
    assert.equal(replay.replayed, true);
    categoryId = category.result.id;
    const product = await createCatalogProduct({ operationId: generateOperationId(), actor: admin, categoryId, name: "Cantarito", sku: "CAT-001", internalCode: "INT-001", sellable: true, inventoryTracked: true, baseUnit: "UNIT", icon: "🍹", imageAlt: "Cantarito preparado" });
    productId = product.result.id;
    const variant = await createCatalogVariant({ operationId: generateOperationId(), actor: admin, productId, name: "Grande", sku: "CAT-001-G", baseUnit: "UNIT", legacyPrice: 99 });
    variantId = variant.result.id;
    assert.ok(await prisma.posProductVariant.findUnique({ where: { id: variantId } }));
  });

  await t.test("branch overrides isolate visibility and local order", async () => {
    await setBranchProductOverride({ actor: admin, branchId: branchA, productId, expectedVersion: 0, enabled: true, visibleInPos: true, availability: "AVAILABLE", sortOrder: 1 });
    await setBranchProductOverride({ actor: admin, branchId: branchB, productId, expectedVersion: 0, enabled: true, visibleInPos: false, availability: "AVAILABLE", sortOrder: 9 });
    const [catalogA, catalogB] = await Promise.all([resolveBranchCatalog(branchA), resolveBranchCatalog(branchB)]);
    assert.equal(catalogA.flatMap((category) => category.products).some((product) => product.id === productId), true);
    assert.equal(catalogB.flatMap((category) => category.products).some((product) => product.id === productId), false);
    assert.equal(catalogA[0].products[0].effective.sortOrder, 1);
  });

  await t.test("duplicate SKU under concurrent admins yields one clean conflict", async () => {
    const create = (suffix: string) => createCatalogProduct({ operationId: generateOperationId(), actor: admin, categoryId, name: `Duplicate ${suffix}`, sku: "DUP-001", sellable: true, inventoryTracked: false, baseUnit: "UNIT" });
    const results = await Promise.allSettled([create("A"), create("B")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected?.reason instanceof DomainError);
    assert.equal(rejected.reason.code, "CONFLICT");
    assert.equal(await prisma.posProduct.count({ where: { sku: "DUP-001" } }), 1);
  });

  await t.test("optimistic version prevents silent concurrent overwrite", async () => {
    const current = await prisma.posProduct.findUniqueOrThrow({ where: { id: productId } });
    const update = (name: string) => updateCatalogProduct({ actor: admin, productId, expectedVersion: current.version, categoryId, name, sku: current.sku ?? undefined, internalCode: current.internalCode ?? undefined, icon: current.icon ?? undefined, imageAlt: current.imageAlt ?? undefined, active: true, sellable: true, inventoryTracked: true, baseUnit: "UNIT", position: current.position });
    const results = await Promise.allSettled([update("Cantarito Uno"), update("Cantarito Dos")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected?.reason instanceof DomainError);
    assert.equal(rejected.reason.code, "CONFLICT");
  });

  await t.test("branch capability cannot be used against another branch", async () => {
    const managerId = `${prefix}-manager`;
    await prisma.user.create({ data: { id: managerId, name: "Catalog Manager", username: managerId, password: "not-a-login", role: "GERENTE" } });
    await prisma.capabilityGrant.create({ data: { capabilityId: "cap-catalog-branch-override-manage", userId: managerId, scope: "BRANCH", branchId: branchA } });
    const manager = { id: managerId, role: "GERENTE" as const, branchIds: [branchA] };
    const override = await prisma.branchProductOverride.findUniqueOrThrow({ where: { branchId_productId: { branchId: branchA, productId } } });
    await setBranchProductOverride({ actor: manager, branchId: branchA, productId, expectedVersion: override.version, enabled: true, visibleInPos: true, availability: "AVAILABLE", sortOrder: 2 });
    await assert.rejects(setBranchProductOverride({ actor: manager, branchId: branchB, productId, expectedVersion: 1, enabled: true, visibleInPos: true, availability: "AVAILABLE" }), (error: unknown) => error instanceof DomainError && error.code === "PERMISSION_DENIED");
  });

  await t.test("archive preserves product, variant and audit history", async () => {
    const current = await prisma.posProduct.findUniqueOrThrow({ where: { id: productId } });
    await archiveCatalogProduct({ actor: admin, productId, expectedVersion: current.version });
    const archived = await prisma.posProduct.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } });
    assert.ok(archived.archivedAt);
    assert.equal(archived.active, false);
    assert.equal(archived.variants.some((variant) => variant.id === variantId), true);
    assert.equal((await resolveBranchCatalog(branchA)).flatMap((category) => category.products).some((product) => product.id === productId), false);
    assert.equal(await prisma.auditEvent.count({ where: { action: "catalog.product.archived", entityId: productId } }), 1);
  });

  await t.test("constant-query effective catalog handles a reasonable DEV dataset", async () => {
    const categoryRows = Array.from({ length: 50 }, (_, index) => ({ id: `${prefix}-perf-cat-${index}`, name: `Perf Category ${index}`, slug: `${prefix}-perf-category-${index}`, position: index, active: true }));
    await prisma.posCategory.createMany({ data: categoryRows });
    const productRows = Array.from({ length: 1000 }, (_, index) => ({ id: `${prefix}-perf-product-${index}`, categoryId: categoryRows[index % 50].id, name: `Perf Product ${index}`, sku: `${prefix.toUpperCase()}-PERF-P-${index}`, position: index, active: true, sellable: true, inventoryTracked: false, baseUnit: "UNIT" as const }));
    await prisma.posProduct.createMany({ data: productRows });
    await prisma.posProductVariant.createMany({ data: productRows.map((product, index) => ({ id: `${prefix}-perf-variant-${index}`, productId: product.id, name: "Único", sku: `${prefix.toUpperCase()}-PERF-V-${index}`, price: 10, position: 0, active: true, baseUnit: "UNIT" as const })) });
    await prisma.branchProductOverride.createMany({ data: productRows.filter((_, index) => index % 4 === 0).map((product, index) => ({ id: `${prefix}-perf-override-${index}`, branchId: branchA, productId: product.id, enabled: true, visibleInPos: true, sortOrder: index, createdById: adminId })) });
    const started = performance.now();
    const catalog = await resolveBranchCatalog(branchA);
    const elapsedMs = performance.now() - started;
    assert.equal(catalog.flatMap((category) => category.products).length >= 1000, true);
    assert.ok(elapsedMs < 5_000, `effective catalog took ${elapsedMs.toFixed(1)}ms`);
    t.diagnostic(`DEV effective catalog: ${elapsedMs.toFixed(1)}ms for 50 categories, 1,000 products and 1,000 variants`);
  });

  await prisma.$disconnect();
});
