import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCountConsumption } from "@/lib/inventory/countConsumption";

test("el costo de vasos usa piezas base y descuenta devoluciones sin contar correcciones", () => {
  const result = summarizeCountConsumption([
    {
      id: "vasos",
      productName: "Vaso grande",
      inventoryBaseUnit: "UNIT",
      handlingUnit: "PAQUETE",
      contentPerUnit: 25,
      contentUnit: "PIEZAS",
      normalizedContentPerUnit: 25,
      unitCostAtTime: 100,
    },
  ], [
    { productId: "vasos", type: "SALE_CONSUMPTION", quantity: -15 },
    { productId: "vasos", type: "SALE_REVERSAL", quantity: 4 },
    { productId: "vasos", type: "COUNT_CORRECTION", quantity: -8 },
  ]);
  assert.equal(result.rows.get("vasos")?.quantity, 11);
  assert.equal(result.rows.get("vasos")?.cost, 44);
  assert.equal(result.knownCost, 44);
  assert.equal(result.missingCostProducts, 0);
});

test("un producto consumido sin costo deja el total incompleto", () => {
  const result = summarizeCountConsumption([
    { id: "tequila", inventoryBaseUnit: "ML", handlingUnit: "BOTELLA", contentPerUnit: 1000, contentUnit: "ML", unitCostAtTime: null },
  ], [{ productId: "tequila", type: "EVENT_LOAD", quantity: -500 }]);
  assert.equal(result.rows.get("tequila")?.quantity, 500);
  assert.equal(result.rows.get("tequila")?.cost, null);
  assert.equal(result.missingCostProducts, 1);
});
