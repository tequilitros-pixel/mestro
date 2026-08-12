import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFermentation, getLatestNumericValue, getPreviousNumericValue } from "../lib/fermentation/fermentationMetrics";

test("obtiene la última lectura y la anterior ignorando nulos", () => {
  const readings = [{ brix: null }, { brix: 4 }, { brix: 6 }];
  assert.equal(getLatestNumericValue(readings, "brix"), 4);
  assert.equal(getPreviousNumericValue(readings, "brix"), 6);
});

test("evalúa progreso y preparación de fermentación", () => {
  const result = evaluateFermentation({ initialBrix: 12, currentBrix: 2, currentPh: 4.2, currentTemp: 30, isFinished: false });
  assert.equal(result.progress, 100);
  assert.equal(result.brixStatus, "LISTA");
  assert.equal(result.health, "LISTA");
  assert.equal(result.isReady, true);
});

test("prioriza alertas de temperatura o pH", () => {
  const result = evaluateFermentation({ initialBrix: 12, currentBrix: 5, currentPh: 5.5, currentTemp: 36, isFinished: false });
  assert.equal(result.temperatureStatus, "ALTA");
  assert.equal(result.phStatus, "ALTO");
  assert.equal(result.health, "ATENCION");
});
