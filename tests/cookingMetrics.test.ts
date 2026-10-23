import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCookingProgress,
  formatDateTime,
  formatDuration,
  getCookingHealth,
  getTemperatureStatus,
  isTemperatureWarning,
} from "../lib/cooking/cookingMetrics";

const reading = (top: number | null, middle: number | null, bottom: number | null) => ({
  temperatureTop: top,
  temperatureMiddle: middle,
  temperatureBottom: bottom,
});

test("clasifica el estado operativo de la cocción", () => {
  assert.equal(getCookingHealth({ hasFinished: true, hasStartedVapor: true, lastTemperature: reading(95, 95, 95) }), "TERMINADA");
  assert.equal(getCookingHealth({ hasFinished: false, hasStartedVapor: false, lastTemperature: null }), "CALENTANDO");
  assert.equal(getCookingHealth({ hasFinished: false, hasStartedVapor: true, lastTemperature: reading(95, null, 95) }), "ATENCION");
  assert.equal(getCookingHealth({ hasFinished: false, hasStartedVapor: true, lastTemperature: reading(90, 92, 94) }), "LISTA");
});

test("detecta lecturas incompletas y fuera de rango", () => {
  assert.equal(getTemperatureStatus(null), "SIN LECTURA");
  assert.equal(getTemperatureStatus(reading(90, null, 92)), "INCOMPLETA");
  assert.equal(getTemperatureStatus(reading(90, 91, 92)), "EN RANGO");
  assert.equal(isTemperatureWarning(reading(90, 101, 92)), true);
  assert.equal(isTemperatureWarning(reading(90, 91, 92)), false);
});

test("calcula progreso contra la meta de 32 horas", () => {
  const startedAt = new Date("2026-01-01T00:00:00Z");
  const referenceAt = new Date("2026-01-01T08:00:00Z");
  assert.deepEqual(
    calculateCookingProgress({ startedAt, finishedAt: null, hasFinished: false, referenceAt }),
    { percentage: 25, duration: "8 h 0 min" }
  );
});

test("formatea duraciones largas y evita valores negativos", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  assert.equal(formatDuration(start, new Date("2026-01-02T02:15:00Z")), "1 d 2 h 15 min");
  assert.equal(formatDuration(start, new Date("2025-12-31T23:00:00Z")), "0 min");
});

test("muestra la hora de Cocimiento en la zona del negocio", () => {
  assert.match(formatDateTime(new Date("2026-09-03T18:15:00.000Z")), /12:15/);
});
