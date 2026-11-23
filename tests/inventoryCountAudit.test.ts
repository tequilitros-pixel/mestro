import assert from "node:assert/strict";
import test from "node:test";
import { isPotentialInventoryCountOutlier } from "../lib/inventory/countAudit";

test("separar tres descuadres extremos del historial de Tlaltenango para auditoría", () => {
  const cases = [
    { expected: 10000980, counted: 4000, normalizedContentPerUnit: 1000, missingCost: 249924.5 },
    { expected: 8182860, counted: 88200, normalizedContentPerUnit: 1800, missingCost: 134911 },
    { expected: 1022000, counted: 1000, normalizedContentPerUnit: 1000, missingCost: 16336 },
  ];
  for (const sample of cases) assert.equal(isPotentialInventoryCountOutlier(sample), true);
  assert.equal(cases.reduce((sum, row) => sum + row.missingCost, 0), 401171.5);
});

test("no excluir faltantes ordinarios o conteos sin evidencia", () => {
  const cases = [
    { expected: 98500, counted: 75000, normalizedContentPerUnit: 5000, missingCost: 94 },
    { expected: 30990, counted: 5000, normalizedContentPerUnit: 1000, missingCost: 3898.5 },
    { expected: 684285, counted: 667450, normalizedContentPerUnit: 1750, missingCost: 269.36 },
    { expected: 10000, counted: null, normalizedContentPerUnit: 1000, missingCost: 20000 },
  ];
  for (const sample of cases) assert.equal(isPotentialInventoryCountOutlier(sample), false);
});
