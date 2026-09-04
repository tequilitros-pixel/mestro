import "server-only";
import type { CatalogBaseUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { normalizeCatalogCode, normalizeCategorySlug } from "./domain";

const text = (value: string | null | undefined) => value?.trim() || null;
function requiredText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) throw new DomainError("VALIDATION_ERROR", { field });
  return normalized;
}

function translateCatalogWriteError(error: unknown): never {
  if (typeof error === "object" && error && "code" in error && String(error.code) === "P2002") {
    throw new DomainError("CONFLICT", { constraint: "catalog_unique_code" }, "El slug, SKU o código ya está registrado.");
  }
  throw error;
}

export async function createCatalogCategory(input: { operationId: string; actor: CommandActor; name: string; slug?: string; description?: string; icon?: string; imageAlt?: string }) {
  const name = requiredText(input.name, "name");
  const slug = normalizeCategorySlug(input.slug || name);
  const payload = { name, slug, description: text(input.description), icon: text(input.icon), imageAlt: text(input.imageAlt) };
  try { return await executeIdempotent({ operationId: input.operationId, command: "CreateCatalogCategory", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    await requireCapability(tx, input.actor, "catalog.category.manage");
    const last = await tx.posCategory.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
    const category = await tx.posCategory.create({ data: { ...payload, position: (last?.position ?? -1) + 1, createdById: input.actor.id } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.category.created", entityType: "PosCategory", entityId: category.id, operationId: input.operationId, metadata: { name, slug } });
    return { type: "CatalogCategory", id: category.id, version: category.version, slug };
  } }); } catch (error) { translateCatalogWriteError(error); }
}

export async function updateCatalogCategory(input: { actor: CommandActor; categoryId: string; expectedVersion: number; name: string; slug: string; active: boolean; position: number; description?: string; icon?: string; imageAlt?: string }) {
  return prisma.$transaction(async (tx) => {
    await requireCapability(tx, input.actor, "catalog.category.manage");
    const before = await tx.posCategory.findUniqueOrThrow({ where: { id: input.categoryId } });
    const result = await tx.posCategory.updateMany({ where: { id: input.categoryId, version: input.expectedVersion }, data: {
      name: requiredText(input.name, "name"), slug: normalizeCategorySlug(input.slug), active: input.active, position: input.position,
      description: text(input.description), icon: text(input.icon), imageAlt: text(input.imageAlt), version: { increment: 1 },
    } });
    if (result.count !== 1) throw new DomainError("CONFLICT", { entity: "PosCategory", expectedVersion: input.expectedVersion });
    const category = await tx.posCategory.findUniqueOrThrow({ where: { id: input.categoryId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.category.updated", entityType: "PosCategory", entityId: category.id, metadata: { oldName: before.name, newName: category.name, oldActive: before.active, newActive: category.active, version: category.version } });
    return category;
  });
}

export async function createCatalogProduct(input: {
  operationId: string; actor: CommandActor; categoryId: string; name: string; description?: string; sku?: string; internalCode?: string; barcode?: string;
  icon?: string; imageAlt?: string; sellable: boolean; inventoryTracked: boolean; baseUnit: CatalogBaseUnit;
}) {
  const name = requiredText(input.name, "name");
  const data = { categoryId: input.categoryId, name, description: text(input.description), sku: normalizeCatalogCode(input.sku), internalCode: normalizeCatalogCode(input.internalCode), barcode: normalizeCatalogCode(input.barcode), icon: text(input.icon), imageAlt: text(input.imageAlt), sellable: input.sellable, inventoryTracked: input.inventoryTracked, baseUnit: input.baseUnit };
  try { return await executeIdempotent({ operationId: input.operationId, command: "CreateCatalogProduct", payload: data, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    await requireCapability(tx, input.actor, "catalog.create");
    const category = await tx.posCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new DomainError("VALIDATION_ERROR", { field: "categoryId" });
    const last = await tx.posProduct.findFirst({ where: { categoryId: input.categoryId }, orderBy: { position: "desc" }, select: { position: true } });
    const product = await tx.posProduct.create({ data: { ...data, position: (last?.position ?? -1) + 1, createdById: input.actor.id } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.product.created", entityType: "PosProduct", entityId: product.id, operationId: input.operationId, metadata: { name, sku: product.sku, categoryId: product.categoryId } });
    return { type: "CatalogProduct", id: product.id, version: product.version };
  } }); } catch (error) { translateCatalogWriteError(error); }
}

export async function updateCatalogProduct(input: {
  actor: CommandActor; productId: string; expectedVersion: number; categoryId: string; name: string; description?: string; sku?: string; internalCode?: string; barcode?: string;
  icon?: string; imageAlt?: string; active: boolean; sellable: boolean; inventoryTracked: boolean; baseUnit: CatalogBaseUnit; position: number;
}) {
  return prisma.$transaction(async (tx) => {
    await requireCapability(tx, input.actor, "catalog.edit");
    const before = await tx.posProduct.findUniqueOrThrow({ where: { id: input.productId } });
    const updated = await tx.posProduct.updateMany({ where: { id: input.productId, version: input.expectedVersion }, data: {
      categoryId: input.categoryId, name: requiredText(input.name, "name"), description: text(input.description), sku: normalizeCatalogCode(input.sku), internalCode: normalizeCatalogCode(input.internalCode), barcode: normalizeCatalogCode(input.barcode),
      icon: text(input.icon), imageAlt: text(input.imageAlt), active: input.active, sellable: input.sellable, inventoryTracked: input.inventoryTracked, baseUnit: input.baseUnit, position: input.position, version: { increment: 1 },
    } });
    if (updated.count !== 1) throw new DomainError("CONFLICT", { entity: "PosProduct", expectedVersion: input.expectedVersion });
    const product = await tx.posProduct.findUniqueOrThrow({ where: { id: input.productId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.product.updated", entityType: "PosProduct", entityId: product.id, metadata: { oldName: before.name, newName: product.name, oldActive: before.active, newActive: product.active, oldSellable: before.sellable, newSellable: product.sellable, version: product.version } });
    return product;
  });
}

export async function archiveCatalogProduct(input: { actor: CommandActor; productId: string; expectedVersion: number }) {
  return prisma.$transaction(async (tx) => {
    await requireCapability(tx, input.actor, "catalog.archive");
    const result = await tx.posProduct.updateMany({ where: { id: input.productId, version: input.expectedVersion }, data: { active: false, sellable: false, archivedAt: new Date(), version: { increment: 1 } } });
    if (result.count !== 1) throw new DomainError("CONFLICT", { entity: "PosProduct", expectedVersion: input.expectedVersion });
    const product = await tx.posProduct.findUniqueOrThrow({ where: { id: input.productId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.product.archived", entityType: "PosProduct", entityId: product.id, metadata: { sku: product.sku, version: product.version } });
    return product;
  });
}

export async function createCatalogVariant(input: { operationId: string; actor: CommandActor; productId: string; name: string; sku?: string; internalCode?: string; barcode?: string; baseUnit: CatalogBaseUnit; legacyPrice: number }) {
  if (!Number.isFinite(input.legacyPrice) || input.legacyPrice < 0) throw new DomainError("VALIDATION_ERROR", { field: "legacyPrice" });
  const data = { productId: input.productId, name: requiredText(input.name, "name"), sku: normalizeCatalogCode(input.sku), internalCode: normalizeCatalogCode(input.internalCode), barcode: normalizeCatalogCode(input.barcode), baseUnit: input.baseUnit, legacyPrice: input.legacyPrice };
  try { return await executeIdempotent({ operationId: input.operationId, command: "CreateCatalogVariant", payload: data, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    await requireCapability(tx, input.actor, "catalog.variant.manage");
    const product = await tx.posProduct.findUnique({ where: { id: input.productId } });
    if (!product) throw new DomainError("VALIDATION_ERROR", { field: "productId" });
    const last = await tx.posProductVariant.findFirst({ where: { productId: input.productId }, orderBy: { position: "desc" }, select: { position: true } });
    const variant = await tx.posProductVariant.create({ data: { productId: input.productId, name: data.name, sku: data.sku, internalCode: data.internalCode, barcode: data.barcode, baseUnit: data.baseUnit, price: input.legacyPrice, position: (last?.position ?? -1) + 1 } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.variant.created", entityType: "PosProductVariant", entityId: variant.id, operationId: input.operationId, metadata: { productId: input.productId, name: variant.name, sku: variant.sku } });
    return { type: "CatalogVariant", id: variant.id, version: variant.version };
  } }); } catch (error) { translateCatalogWriteError(error); }
}

export async function updateCatalogVariant(input: { actor: CommandActor; variantId: string; expectedVersion: number; name: string; sku?: string; internalCode?: string; barcode?: string; baseUnit: CatalogBaseUnit; active: boolean; position: number; legacyPrice: number }) {
  if (!Number.isFinite(input.legacyPrice) || input.legacyPrice < 0) throw new DomainError("VALIDATION_ERROR", { field: "legacyPrice" });
  return prisma.$transaction(async (tx) => {
    await requireCapability(tx, input.actor, "catalog.variant.manage");
    const before = await tx.posProductVariant.findUniqueOrThrow({ where: { id: input.variantId } });
    const result = await tx.posProductVariant.updateMany({ where: { id: input.variantId, version: input.expectedVersion }, data: { name: requiredText(input.name, "name"), sku: normalizeCatalogCode(input.sku), internalCode: normalizeCatalogCode(input.internalCode), barcode: normalizeCatalogCode(input.barcode), baseUnit: input.baseUnit, active: input.active, position: input.position, price: input.legacyPrice, version: { increment: 1 } } });
    if (result.count !== 1) throw new DomainError("CONFLICT", { entity: "PosProductVariant", expectedVersion: input.expectedVersion });
    const variant = await tx.posProductVariant.findUniqueOrThrow({ where: { id: input.variantId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, action: "catalog.variant.updated", entityType: "PosProductVariant", entityId: variant.id, metadata: { oldName: before.name, newName: variant.name, oldActive: before.active, newActive: variant.active, version: variant.version } });
    return variant;
  });
}
