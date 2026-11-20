import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  allocatedFermentationLiters,
  fermentationHasActiveLoad,
  fermentationHasCompletedLoad,
  fermentationLatestFinishedLoad,
  totalRunLoadedLiters,
} from "../lib/distillation/loadLedger";

test("suma carga inicial y adicionales sin repetir litros en el alambique", () => {
  const run = { loadedLiters: 600, supplementalLoads: [{ liters: 200 }, { liters: 150 }] };
  assert.equal(totalRunLoadedLiters(run), 950);
});

test("la tina descuenta solamente carga primaria y adicionales de corridas no canceladas", () => {
  const source = {
    distillations: [
      { loadedLiters: 600, status: "ACTIVA" },
      { loadedLiters: 100, status: "CANCELADA" },
    ],
    supplementalLoads: [
      { liters: 200, distillation: { status: "ACTIVA" } },
      { liters: 150, distillation: { status: "CANCELADA" } },
    ],
  };
  assert.equal(allocatedFermentationLiters(source), 800);
  assert.equal(1000 - allocatedFermentationLiters(source), 200);
  assert.equal(fermentationHasActiveLoad(source), true);
});

test("una carga posterior de tina 2 no se suma a la tina 1", () => {
  const tina1 = {
    distillations: [{ loadedLiters: 500, status: "ACTIVA" }],
    supplementalLoads: [],
  };
  const tina2 = {
    distillations: [],
    supplementalLoads: [{ liters: 250, distillation: { status: "ACTIVA" } }],
  };
  assert.equal(allocatedFermentationLiters(tina1), 500);
  assert.equal(allocatedFermentationLiters(tina2), 250);
});

test("detecta corridas terminadas de cargas adicionales para exigir conciliación física", () => {
  const first = new Date("2026-11-19T12:00:00.000Z");
  const later = new Date("2026-11-19T14:00:00.000Z");
  const source = {
    distillations: [{ loadedLiters: 500, status: "TERMINADA", finishedAt: first }],
    supplementalLoads: [{ liters: 200, distillation: { status: "TERMINADA", finishedAt: later } }],
  };
  assert.equal(fermentationHasActiveLoad(source), false);
  assert.equal(fermentationHasCompletedLoad(source), true);
  assert.deepEqual(fermentationLatestFinishedLoad(source), later);
});

test("la migración registra procedencia, operador, idempotencia y volumen positivo", () => {
  const sql = fs.readFileSync("prisma/migrations/20261120050000_distillation_supplemental_load/migration.sql", "utf8");
  assert.match(sql, /"fermentationId" TEXT NOT NULL/);
  assert.match(sql, /"distillationId" TEXT NOT NULL/);
  assert.match(sql, /"idempotencyKey" TEXT NOT NULL/);
  assert.match(sql, /"recordedById" TEXT NOT NULL/);
  assert.match(sql, /CHECK \("liters" > 0\)/);
});
