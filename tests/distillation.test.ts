import assert from "node:assert/strict";
import test from "node:test";
import { getAbsoluteAlcohol, getCorrectedAlcohol, getYield } from "../lib/services/distillation";

test("calcula métricas principales de destilación", () => {
  assert.equal(getCorrectedAlcohol(null, 20), null);
  assert.equal(getAbsoluteAlcohol(100, 50), 50);
  assert.equal(getYield(1000, 750), 75);
});

test("protege cálculos sin medición alcohólica", () => {
  assert.equal(getAbsoluteAlcohol(100, null), null);
});
