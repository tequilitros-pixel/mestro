import assert from "node:assert/strict";
import test from "node:test";
import { formatHumanInventoryQuantity } from "../../lib/inventory/units";

test("formatea sal y sólidos en gramos y kilos razonables", () => {
  // Sal, tajín, azúcar
  assert.equal(formatHumanInventoryQuantity(10000, "g"), "10 kg");
  assert.equal(formatHumanInventoryQuantity(-10000, "g"), "−10 kg");
  assert.equal(formatHumanInventoryQuantity(2500, "g"), "2.5 kg");
  assert.equal(formatHumanInventoryQuantity(250, "g"), "250 g");
  assert.equal(formatHumanInventoryQuantity(10, "kg"), "10 kg");
  assert.equal(formatHumanInventoryQuantity(-5.5, "kg"), "−5.5 kg");
});

test("formatea tequila, agua mineral y líquidos en mililitros y litros razonables", () => {
  // Tequila, agua mineral, jarabes
  assert.equal(formatHumanInventoryQuantity(45000, "ml"), "45 L");
  assert.equal(formatHumanInventoryQuantity(-1500, "ml"), "−1.5 L");
  assert.equal(formatHumanInventoryQuantity(750, "ml"), "750 ml");
  assert.equal(formatHumanInventoryQuantity(45, "ml"), "45 ml");
  assert.equal(formatHumanInventoryQuantity(12, "L"), "12 L");
});

test("formatea piezas y unidades", () => {
  assert.equal(formatHumanInventoryQuantity(1, "pza"), "1 pza");
  assert.equal(formatHumanInventoryQuantity(12, "pza"), "12 pzas");
  assert.equal(formatHumanInventoryQuantity(5, "piezas"), "5 pzas");
});

test("maneja valores nulos e inválidos", () => {
  assert.equal(formatHumanInventoryQuantity(null, "g"), "—");
  assert.equal(formatHumanInventoryQuantity(undefined, "ml"), "—");
  assert.equal(formatHumanInventoryQuantity(0, "kg"), "0 kg");
});
