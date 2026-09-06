import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCatalogCode, normalizeCategorySlug, resolveEffectiveProduct } from "@/lib/pos2/catalog/domain";

const product = { active: true, sellable: true, position: 7, archivedAt: null as Date | null, name: "Cantarito" };

test("catalog codes and category slugs normalize deterministically", () => {
  assert.equal(normalizeCatalogCode("  sku-01 "), "SKU-01");
  assert.equal(normalizeCategorySlug("Bebidas Frías / Especiales"), "bebidas-frias-especiales");
  assert.throws(() => normalizeCatalogCode("?"));
});

test("global product is enabled and ordered without an override", () => {
  const effective = resolveEffectiveProduct(product, null);
  assert.equal(effective.effective.visibleInPos, true);
  assert.equal(effective.effective.sortOrder, 7);
  assert.equal(effective.effective.hasOverride, false);
});

test("branch override can hide, disable and reorder without changing global data", () => {
  const hidden = resolveEffectiveProduct(product, { enabled: true, visibleInPos: false, availability: "AVAILABLE", sortOrder: 1 });
  assert.equal(hidden.effective.enabled, true);
  assert.equal(hidden.effective.visibleInPos, false);
  assert.equal(hidden.effective.sortOrder, 1);
  const unavailable = resolveEffectiveProduct(product, { enabled: true, visibleInPos: true, availability: "TEMPORARILY_UNAVAILABLE", sortOrder: null });
  assert.equal(unavailable.effective.visibleInPos, false);
});

test("inactive, archived or not-sellable are distinct global gates", () => {
  assert.equal(resolveEffectiveProduct({ ...product, active: false }, null).effective.enabled, false);
  assert.equal(resolveEffectiveProduct({ ...product, sellable: false }, null).effective.enabled, false);
  assert.equal(resolveEffectiveProduct({ ...product, archivedAt: new Date() }, null).effective.enabled, false);
});
