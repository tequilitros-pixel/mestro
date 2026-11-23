import assert from "node:assert/strict";
import test from "node:test";
import { consolidateSaleConsumption } from "../lib/inventory/saleConsumptionSummary";

test("un mismo producto se muestra una sola vez aunque se venda en varias sucursales", () => {
  const rows = consolidateSaleConsumption([
    { inventoryProductId: "tequila", branchId: "centro", unit: "ML", movementType: "SALE_CONSUMPTION", quantityDelta: -47400, movements: 277 },
    { inventoryProductId: "tequila", branchId: "tlaltenango", unit: "ML", movementType: "SALE_CONSUMPTION", quantityDelta: -32240, movements: 157 },
    { inventoryProductId: "tequila", branchId: "centro", unit: "ML", movementType: "SALE_REVERSAL", quantityDelta: 200, movements: 1 },
    { inventoryProductId: "toronja", branchId: "centro", unit: "ML", movementType: "SALE_CONSUMPTION", quantityDelta: -1200, movements: 3 },
  ]);
  assert.equal(rows.length, 2);
  const tequila = rows.find((row) => row.inventoryProductId === "tequila");
  assert.ok(tequila);
  assert.equal(tequila.amount, 79440);
  assert.equal(tequila.saleMovements, 434);
  assert.equal(tequila.reversalMovements, 1);
  assert.equal(tequila.branches.length, 2);
  assert.equal(tequila.branches[0].amount, 47200);
  assert.equal(tequila.branches[1].amount, 32240);
});

test("no se mezclan unidades base incompatibles ni devoluciones con consumo", () => {
  const rows = consolidateSaleConsumption([
    { inventoryProductId: "p", branchId: "centro", unit: "ML", movementType: "SALE_CONSUMPTION", quantityDelta: -120, movements: 2 },
    { inventoryProductId: "p", branchId: "centro", unit: "UNIT", movementType: "SALE_CONSUMPTION", quantityDelta: -1, movements: 1 },
    { inventoryProductId: "p", branchId: "centro", unit: "ML", movementType: "SALE_REVERSAL", quantityDelta: 200, movements: 1 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.unit === "ML")?.amount, 0);
  assert.equal(rows.find((row) => row.unit === "UNIT")?.amount, 1);
});
