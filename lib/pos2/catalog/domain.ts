import type { BranchProductAvailability, CatalogBaseUnit } from "@prisma/client";

export const CATALOG_BASE_UNITS = ["UNIT", "ML"] as const satisfies readonly CatalogBaseUnit[];

export function normalizeCatalogCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() || null;
  if (normalized && !/^[A-Z0-9][A-Z0-9._/-]{1,63}$/.test(normalized)) throw new Error("INVALID_CATALOG_CODE");
  return normalized;
}

export function normalizeCategorySlug(value: string) {
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!normalized || normalized.length > 64) throw new Error("INVALID_CATEGORY_SLUG");
  return normalized;
}

export type EffectiveOverride = {
  enabled: boolean;
  visibleInPos: boolean;
  availability: BranchProductAvailability;
  sortOrder: number | null;
} | null;

export function resolveEffectiveProduct<T extends { active: boolean; sellable: boolean; position: number; archivedAt: Date | null }>(product: T, override: EffectiveOverride) {
  const enabled = product.active && product.sellable && !product.archivedAt && (override?.enabled ?? true);
  const visibleInPos = enabled && (override?.visibleInPos ?? true) && (override?.availability ?? "AVAILABLE") === "AVAILABLE";
  return {
    ...product,
    effective: {
      enabled,
      visibleInPos,
      availability: override?.availability ?? "AVAILABLE",
      sortOrder: override?.sortOrder ?? product.position,
      hasOverride: Boolean(override),
    },
  };
}
