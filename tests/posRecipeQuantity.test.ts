import assert from "node:assert/strict";
import test from "node:test";
import { normalizePosRecipeQuantity } from "../lib/pos/normalizeRecipeQuantity";

test("dos botellas Wixárika de 1 L consumen 2000 ML", () => {
  const normalized = normalizePosRecipeQuantity(2, "UNIT", {
    inventoryBaseUnit: "ML",
    handlingUnit: "PIEZA",
    contentPerUnit: "1",
    contentUnit: "L",
    normalizedContentPerUnit: "1000",
  });
  assert.equal(normalized?.unit, "ML");
  assert.equal(normalized?.quantity.toString(), "2000");
});

test("una receta ya expresada en base ML conserva exactamente su cantidad", () => {
  const normalized = normalizePosRecipeQuantity("90", "ML", { inventoryBaseUnit: "ML" });
  assert.equal(normalized?.quantity.toString(), "90");
  assert.equal(normalized?.unit, "ML");
});

test("una receta inconsistente sin presentación verificable permanece bloqueada", () => {
  assert.equal(normalizePosRecipeQuantity(2, "UNIT", {
    inventoryBaseUnit: "ML",
    handlingUnit: "PIEZA",
    contentPerUnit: "1",
    contentUnit: "G",
  }), null);
  assert.equal(normalizePosRecipeQuantity(2, "UNIT", {
    inventoryBaseUnit: "G",
    handlingUnit: null,
    contentPerUnit: "1",
    contentUnit: "KG",
  }), null);
});
