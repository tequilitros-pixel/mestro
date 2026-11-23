import assert from "node:assert/strict";
import test from "node:test";
import { costPerInventoryBaseUnit, inventoryBaseUnitLabel } from "../../lib/accounting/inventoryCost";

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
  assert.ok(hielo !== null && aguaMineral !== null);
  assert.equal(Number((21000 * hielo).toFixed(2)), 84);
  assert.equal(Number((7790 * aguaMineral).toFixed(2)), 124.64);
  // Multiplicar 21,000 gramos por $20/bolsa sobrevalúa la diferencia 5,000 veces.
  assert.notEqual(21000 * 20, 21000 * hielo);
});
