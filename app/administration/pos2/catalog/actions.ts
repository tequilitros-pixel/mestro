"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth";
import { createCatalogCategory, createCatalogProduct, createCatalogVariant, updateCatalogCategory, updateCatalogProduct, updateCatalogVariant, archiveCatalogProduct } from "@/lib/pos2/catalog/manageCatalog";
import { setBranchProductOverride } from "@/lib/pos2/catalog/manageBranchOverride";

async function actor() {
  const user = await requireAdminAction();
  return { id: user.id, role: user.role, branchIds: null } as const;
}
const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";
const optional = (form: FormData, key: string) => String(form.get(key) ?? "").trim() || undefined;
const refresh = () => { revalidatePath("/administration/pos2/catalog"); revalidatePath("/administration/pos2/catalog/preview"); };

export async function createCategoryAction(form: FormData) {
  await createCatalogCategory({ operationId: String(form.get("operationId")), actor: await actor(), name: String(form.get("name") ?? ""), slug: optional(form, "slug"), description: optional(form, "description"), icon: optional(form, "icon"), imageAlt: optional(form, "imageAlt") });
  refresh();
}

export async function updateCategoryAction(form: FormData) {
  await updateCatalogCategory({ actor: await actor(), categoryId: String(form.get("categoryId")), expectedVersion: Number(form.get("version")), name: String(form.get("name")), slug: String(form.get("slug")), active: bool(form, "active"), position: Number(form.get("position")), description: optional(form, "description"), icon: optional(form, "icon"), imageAlt: optional(form, "imageAlt") });
  refresh();
}

export async function createProductAction(form: FormData) {
  await createCatalogProduct({ operationId: String(form.get("operationId")), actor: await actor(), categoryId: String(form.get("categoryId")), name: String(form.get("name")), description: optional(form, "description"), sku: optional(form, "sku"), internalCode: optional(form, "internalCode"), barcode: optional(form, "barcode"), icon: optional(form, "icon"), imageAlt: optional(form, "imageAlt"), sellable: bool(form, "sellable"), inventoryTracked: bool(form, "inventoryTracked"), baseUnit: form.get("baseUnit") === "ML" ? "ML" : "UNIT" });
  refresh();
}

export async function updateProductAction(form: FormData) {
  await updateCatalogProduct({ actor: await actor(), productId: String(form.get("productId")), expectedVersion: Number(form.get("version")), categoryId: String(form.get("categoryId")), name: String(form.get("name")), description: optional(form, "description"), sku: optional(form, "sku"), internalCode: optional(form, "internalCode"), barcode: optional(form, "barcode"), icon: optional(form, "icon"), imageAlt: optional(form, "imageAlt"), active: bool(form, "active"), sellable: bool(form, "sellable"), inventoryTracked: bool(form, "inventoryTracked"), baseUnit: form.get("baseUnit") === "ML" ? "ML" : "UNIT", position: Number(form.get("position")) });
  refresh();
}

export async function archiveProductAction(form: FormData) {
  await archiveCatalogProduct({ actor: await actor(), productId: String(form.get("productId")), expectedVersion: Number(form.get("version")) });
  refresh();
}

export async function createVariantAction(form: FormData) {
  await createCatalogVariant({ operationId: String(form.get("operationId")), actor: await actor(), productId: String(form.get("productId")), name: String(form.get("name")), sku: optional(form, "sku"), internalCode: optional(form, "internalCode"), barcode: optional(form, "barcode"), baseUnit: form.get("baseUnit") === "ML" ? "ML" : "UNIT", legacyPrice: Number(form.get("legacyPrice")) });
  refresh();
}

export async function updateVariantAction(form: FormData) {
  await updateCatalogVariant({ actor: await actor(), variantId: String(form.get("variantId")), expectedVersion: Number(form.get("version")), name: String(form.get("name")), sku: optional(form, "sku"), internalCode: optional(form, "internalCode"), barcode: optional(form, "barcode"), baseUnit: form.get("baseUnit") === "ML" ? "ML" : "UNIT", active: bool(form, "active"), position: Number(form.get("position")), legacyPrice: Number(form.get("legacyPrice")) });
  refresh();
}

export async function setOverrideAction(form: FormData) {
  await setBranchProductOverride({ actor: await actor(), branchId: String(form.get("branchId")), productId: String(form.get("productId")), expectedVersion: Number(form.get("version")), enabled: bool(form, "enabled"), visibleInPos: bool(form, "visibleInPos"), availability: form.get("availability") === "TEMPORARILY_UNAVAILABLE" ? "TEMPORARILY_UNAVAILABLE" : "AVAILABLE", sortOrder: optional(form, "sortOrder") ? Number(form.get("sortOrder")) : null });
  refresh();
}
