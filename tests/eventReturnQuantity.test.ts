import assert from "node:assert/strict";
import test from "node:test";
import { parseReturnQuantity } from "../lib/inventory/returnQuantity";
import { buildEventConsumption } from "../lib/inventory/eventAnalytics";

test("acepta fracciones de presentación con punto o coma", () => {
  for (const [draft, expected] of [["11.5", 11.5], ["11,3", 11.3], [".3", 0.3], ["0", 0]] as const) {
    assert.equal(parseReturnQuantity(draft), expected);
  }
  for (const invalid of ["", ".", "-", "-1", "1.2345"]) assert.equal(parseReturnQuantity(invalid), null);
});

test("regresar 0.3 de un bote deja un consumo de 0.7", () => {
  const [row] = buildEventConsumption([{ productId: "chamoy", name: "Chamoy", category: "Insumos",
    unit: "bote", itemType: "CONSUMABLE", sent: 1, returned: parseReturnQuantity(".3")!,
    damaged: 0, returnedOpenBase: 0, contentPerUnit: 1, contentUnit: "PIEZAS", unitCost: null }]);
  assert.equal(row.returned, 0.3);
  assert.equal(row.consumed, 0.7);
});
