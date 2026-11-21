import assert from "node:assert/strict";
import test from "node:test";
import { getInventoryProductState, isOperationalInventoryProduct } from "../lib/inventory/productState";
import { classifyLegacyInventoryRow } from "../lib/inventory/legacyReport";
import { assertLegacyInventoryProductUsable } from "../lib/inventory/legacyProductGuard";

test("archivado es un estado separado y restaurar no cambia isActive", () => {
  assert.equal(getInventoryProductState({ isActive: true, archivedAt: null }), "ACTIVE");
  assert.equal(getInventoryProductState({ isActive: false, archivedAt: null }), "INACTIVE");
  assert.equal(getInventoryProductState({ isActive: true, archivedAt: "2026-09-12T12:00:00.000Z" }), "ARCHIVED");
  assert.equal(isOperationalInventoryProduct({ isActive: true, archivedAt: null, trackStock: true }), true);
  assert.equal(isOperationalInventoryProduct({ isActive: true, archivedAt: "2026-09-12T12:00:00.000Z", trackStock: true }), false);
});

test("el reporte legacy clasifica sin proponer reparación", () => {
  assert.deepEqual(
    classifyLegacyInventoryRow({
      hasV2Balance: false,
      currentStock: -900,
      hasLegacyEvidence: true,
      hasBaseUnit: true,
      hasValidPresentation: true,
      historicalFactorPresent: false,
      historicalFactorMatches: false,
    }),
    {
      source: "LEGACY_READ_MODEL",
      classification: "LEGACY_NEGATIVE",
      reasons: ["Saldo legacy negativo; conservar signo y revisar manualmente"],
    },
  );
  assert.deepEqual(
    classifyLegacyInventoryRow({
      hasV2Balance: false,
      currentStock: 31500,
      hasLegacyEvidence: true,
      hasBaseUnit: true,
      hasValidPresentation: true,
      historicalFactorPresent: true,
      historicalFactorMatches: false,
    })?.classification,
    "HISTORICAL_FACTOR_MISMATCH",
  );
  assert.equal(
    classifyLegacyInventoryRow({
      hasV2Balance: true,
      currentStock: -1,
      hasLegacyEvidence: true,
      hasBaseUnit: true,
      hasValidPresentation: true,
      historicalFactorPresent: false,
      historicalFactorMatches: false,
    })?.reasons[0],
    "Balance V2 negativo inesperado",
  );
});

test("el puente POS legacy rechaza productos archivados antes del fallback", () => {
  assert.throws(
    () => assertLegacyInventoryProductUsable({ id: "archived", name: "Producto archivado", archivedAt: "2026-09-12T12:00:00.000Z" }),
    (error: unknown) => error instanceof Error && error.name === "DomainError",
  );
});
