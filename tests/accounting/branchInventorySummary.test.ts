import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBranchInventory } from "../../lib/accounting/branchInventorySummary";

test("el resumen de inventario separa consumo registrado, devoluciones y consumo teórico", () => {
  const overview = summarizeBranchInventory({
    actualRows: [
      { productId: "limon", code: "LIM", name: "Limón", category: "Fruta", unit: "PZA", quantity: -10, unitCost: 2, direction: "consumption" },
      { productId: "limon", code: "LIM", name: "Limón", category: "Fruta", unit: "PZA", quantity: 2, unitCost: 2, direction: "reversal" },
    ],
    theoreticalRows: [
      { productId: "limon", code: "LIM", name: "Limón", category: "Fruta", unit: "PZA", quantity: 9, unitCost: 2 },
      { productId: "sal", code: "SAL", name: "Sal", category: "Abarrotes", unit: "G", quantity: 12, unitCost: null },
    ],
    saleCount: 3,
  });

  assert.deepEqual(overview.actual, { products: 1, movements: 2, cost: 16, costKnown: true });
  assert.deepEqual(overview.theoretical, { products: 2, sales: 3, cost: 18, costKnown: false });
  assert.deepEqual(overview.products, [
    { id: "limon", code: "LIM", name: "Limón", category: "Fruta", unit: "PZA", actualQuantity: 8, theoreticalQuantity: 9, actualCost: 16, theoreticalCost: 18, actualCostKnown: true, theoreticalCostKnown: true },
    { id: "sal", code: "SAL", name: "Sal", category: "Abarrotes", unit: "G", actualQuantity: 0, theoreticalQuantity: 12, actualCost: 0, theoreticalCost: 0, actualCostKnown: true, theoreticalCostKnown: false },
  ]);
});
