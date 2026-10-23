import assert from "node:assert/strict";
import test from "node:test";
import { getAbsoluteAlcohol, getCorrectedAlcohol, getYield } from "../lib/services/distillation";

test("calcula métricas principales de destilación", () => {
  assert.equal(getCorrectedAlcohol(null, 20), null);
  assert.equal(getCorrectedAlcohol(50, 20), 50);
  assert.equal(getCorrectedAlcohol(55, 28), 53.56);
  assert.equal(getCorrectedAlcohol(55, 16), 55.72);
  assert.equal(getAbsoluteAlcohol(100, 50), 50);
  assert.equal(getYield(1000, 750), 75);
});

test("protege cálculos sin medición alcohólica", () => {
  assert.equal(getAbsoluteAlcohol(100, null), null);
});
