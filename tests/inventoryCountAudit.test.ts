import assert from "node:assert/strict";
import test from "node:test";
import { isPotentialInventoryCountOutlier, isImplausibleInventoryIncrease } from "../lib/inventory/countAudit";

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

test("detecta capturas físicas históricas desproporcionadas antes de cerrar", () => {
  const historicCountIncreases = [
    { expected: 86880, captured: 8181000, normalizedContentPerUnit: 1800, costPerBaseUnit: 30 / 1800 },
    { expected: 3000, captured: 1010000, normalizedContentPerUnit: 1000, costPerBaseUnit: 16 / 1000 },
    { expected: 1927.1, captured: 1121000, normalizedContentPerUnit: 1000, costPerBaseUnit: 20 / 1000 },
    { expected: 70, captured: 10000070, normalizedContentPerUnit: 1000, costPerBaseUnit: 25 / 1000 },
  ];
  for (const sample of historicCountIncreases) {
    assert.equal(isImplausibleInventoryIncrease(sample), true);
  }
});

test("no bloquea cambios normales ni cantidades sin evidencia financiera suficiente", () => {
  const ordinaryCount = { expected: 98500, captured: 105000, normalizedContentPerUnit: 5000, costPerBaseUnit: 20 / 5000 };
  assert.equal(isImplausibleInventoryIncrease(ordinaryCount), false);
  // Cuando falta costo, aún identificamos capturas de más de 1,000 presentaciones.
  assert.equal(isImplausibleInventoryIncrease({
    expected: 1000, captured: 1001000, normalizedContentPerUnit: 1000, costPerBaseUnit: null,
  }), true);
  assert.equal(isPotentialInventoryCountOutlier({
    expected: 1001000, counted: 1000, normalizedContentPerUnit: 1000, missingCost: 0,
  }), true);
});
