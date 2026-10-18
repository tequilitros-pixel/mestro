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
