import assert from "node:assert/strict";
import test from "node:test";
import { costPerInventoryBaseUnit, inventoryBaseUnitLabel, resolveInventoryCountUnitCost } from "../../lib/accounting/inventoryCost";

test("convierte el costo de una presentación a su unidad base V2", () => {
  assert.equal(costPerInventoryBaseUnit({ unitCost: 150, inventoryBaseUnit: "ML", normalizedContentPerUnit: 750 }), 0.2);
  assert.equal(costPerInventoryBaseUnit({ unitCost: 60, inventoryBaseUnit: "G", normalizedContentPerUnit: 1000 }), 0.06);
  assert.equal(costPerInventoryBaseUnit({ unitCost: 12, inventoryBaseUnit: "UNIT", normalizedContentPerUnit: 1 }), 12);
});

test("conserva el costo histórico cuando no hay una presentación base configurada", () => {
  assert.equal(costPerInventoryBaseUnit({ unitCost: 35, inventoryBaseUnit: null, normalizedContentPerUnit: null }), 35);
  assert.equal(costPerInventoryBaseUnit({ unitCost: null, inventoryBaseUnit: "ML", normalizedContentPerUnit: 750 }), null);
  assert.equal(inventoryBaseUnitLabel("ML", "Botella"), "ml");
  assert.equal(inventoryBaseUnitLabel(null, "Botella"), "Botella");
});

test("el costo del resumen semanal se calcula por ml y g, no por presentación completa", () => {
  const hielo = costPerInventoryBaseUnit({
    unitCost: 20, inventoryBaseUnit: "G", normalizedContentPerUnit: 5000,
  });
  const aguaMineral = costPerInventoryBaseUnit({
    unitCost: 28, inventoryBaseUnit: "ML", normalizedContentPerUnit: 1750,
  });
  if (hielo === null || aguaMineral === null) throw new Error("Faltan factores de conversión");
  assert.equal(Number((21000 * hielo).toFixed(2)), 84);
  assert.equal(Number((7790 * aguaMineral).toFixed(2)), 124.64);
  // Multiplicar 21,000 gramos por $20/bolsa sobrevalúa la diferencia 5,000 veces.
  assert.notEqual(21000 * 20, 21000 * hielo);
});

test("conteos históricos: distingue precio de presentación del costo por ml", () => {
  const toronja = { unitCost: 30, inventoryBaseUnit: "ML", normalizedContentPerUnit: 1800 };
  const reciente = resolveInventoryCountUnitCost(toronja, 30);
  assert.equal(reciente.unitCost, 30 / 1800);
  assert.equal(reciente.snapshotInPresentation, true);

  const anterior = resolveInventoryCountUnitCost(toronja, 0.0167);
  assert.equal(anterior.unitCost, 30 / 1800);
  assert.equal(anterior.snapshotInPresentation, false);

  assert.equal(resolveInventoryCountUnitCost({ unitCost: 3, inventoryBaseUnit: "UNIT", normalizedContentPerUnit: 1 }, 3).unitCost, 3);
  assert.equal(resolveInventoryCountUnitCost(toronja, null).unitCost, 30 / 1800);
  assert.equal(resolveInventoryCountUnitCost({ unitCost: null, inventoryBaseUnit: "ML", normalizedContentPerUnit: 1800 }, null).missingCost, true);
});

test("el precio por botella del snapshot no multiplica mililitros por $800", () => {
  const item = { unitCost: 800, inventoryBaseUnit: "ML", normalizedContentPerUnit: 1000 };
  const cost = resolveInventoryCountUnitCost(item, 800);
  assert.equal(cost.unitCost * 1000, 800);
  assert.notEqual(cost.unitCost * 1000, 800000);
});
