import assert from "node:assert/strict";
import test from "node:test";
import { getMillingHealth, weightedAverage } from "../lib/milling/millingMetrics";

const discharges = [
  { litersRecovered: 100, brix: 12, ph: 4, temperature: 30 },
  { litersRecovered: 300, brix: 8, ph: 5, temperature: 34 },
];

test("calcula promedios ponderados por litros", () => {
  assert.equal(weightedAverage(discharges, (item) => item.brix), 9);
  assert.equal(weightedAverage([], (item) => item.brix), null);
});

test("clasifica condiciones de molienda", () => {
  assert.equal(getMillingHealth({ hasFinished: false, dischargesCount: 2, totalLiters: 400, averageBrix: 9, averagePh: 4.75, averageTemperature: 33 }), "LISTA");
  assert.equal(getMillingHealth({ hasFinished: false, dischargesCount: 1, totalLiters: 100, averageBrix: 9, averagePh: 6.5, averageTemperature: 33 }), "ATENCION");
  assert.equal(getMillingHealth({ hasFinished: true, dischargesCount: 0, totalLiters: 0, averageBrix: null, averagePh: null, averageTemperature: null }), "TERMINADA");
});
