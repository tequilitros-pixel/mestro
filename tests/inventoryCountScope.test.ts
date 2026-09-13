import assert from "node:assert/strict";
import test from "node:test";
import {
  inventoryCountFrequencyLabel,
  inventoryCountTypeLabel,
  isProductIncludedInInventoryCount,
} from "@/lib/inventory/countScope";

const products = [
  {
    id: "ingredient-a",
    isActive: true,
    archivedAt: null,
    trackStock: true,
    countFrequency: "WEEKLY" as const,
  },
  {
    id: "drink-b",
    isActive: true,
    archivedAt: null,
    trackStock: true,
    countFrequency: "WEEKLY" as const,
  },
  {
    id: "table-c",
    isActive: true,
    archivedAt: null,
    trackStock: true,
    countFrequency: "MONTHLY_ONLY" as const,
  },
  {
    id: "multicontact-d",
    isActive: true,
    archivedAt: null,
    trackStock: true,
    countFrequency: "MONTHLY_ONLY" as const,
  },
];

test("el conteo semanal sólo incluye productos clasificados semanalmente", () => {
  assert.deepEqual(
    products
      .filter((product) => isProductIncludedInInventoryCount(product, "WEEKLY"))
      .map((product) => product.id),
    ["ingredient-a", "drink-b"],
  );
});

test("el conteo mensual incluye productos semanales y sólo mensuales", () => {
  assert.deepEqual(
    products
      .filter((product) => isProductIncludedInInventoryCount(product, "MONTHLY"))
      .map((product) => product.id),
    ["ingredient-a", "drink-b", "table-c", "multicontact-d"],
  );
});

test("productos inactivos, archivados o sin seguimiento quedan fuera de ambos conteos", () => {
  const excluded = [
    { isActive: false, archivedAt: null, trackStock: true, countFrequency: "WEEKLY" as const },
    { isActive: true, archivedAt: "2026-09-12T00:00:00.000Z", trackStock: true, countFrequency: "WEEKLY" as const },
    { isActive: true, archivedAt: null, trackStock: false, countFrequency: "WEEKLY" as const },
  ];

  for (const product of excluded) {
    assert.equal(isProductIncludedInInventoryCount(product, "WEEKLY"), false);
    assert.equal(isProductIncludedInInventoryCount(product, "MONTHLY"), false);
  }

  const pending = {
    isActive: true,
    archivedAt: null,
    trackStock: true,
    countFrequency: "UNCLASSIFIED" as const,
  };
  assert.equal(isProductIncludedInInventoryCount(pending, "WEEKLY"), false);
  assert.equal(isProductIncludedInInventoryCount(pending, "MONTHLY"), true);
});

test("las etiquetas distinguen alcance y clasificación", () => {
  assert.equal(inventoryCountTypeLabel("WEEKLY"), "Conteo semanal");
  assert.equal(inventoryCountTypeLabel("MONTHLY"), "Conteo mensual");
  assert.equal(inventoryCountFrequencyLabel("UNCLASSIFIED"), "Pendiente de clasificar");
});
