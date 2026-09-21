import assert from "node:assert/strict";
import test from "node:test";
import { getLotFinalization } from "../lib/lots/finalization";

test("un destrozado terminado todavía no permite cerrar el lote", () => {
  assert.deepEqual(
    getLotFinalization({
      stage: "RECTIFICACION",
      finishedAt: null,
      totalLitersObtained: null,
      runs: [{ type: "DESTROZADO", status: "TERMINADA", finalLiters: 376 }],
    }),
    { ready: false, reason: "LOT_STAGE_INCOMPLETE" },
  );
});

test("el cierre suma solamente las rectificaciones terminadas", () => {
  assert.deepEqual(
    getLotFinalization({
      stage: "TERMINADO",
      finishedAt: null,
      totalLitersObtained: null,
      runs: [
        { type: "DESTROZADO", status: "TERMINADA", finalLiters: 150 },
        { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 20 },
        { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 25 },
      ],
    }),
    { ready: true, totalLiters: 45 },
  );
});

test("una corrida activa bloquea el cierre", () => {
  assert.deepEqual(
    getLotFinalization({
      stage: "TERMINADO",
      finishedAt: null,
      totalLitersObtained: null,
      runs: [
        { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 45 },
        { type: "RECTIFICACION", status: "ACTIVA", finalLiters: null },
      ],
    }),
    { ready: false, reason: "ACTIVE_RUNS" },
  );
});

test("un lote ya cerrado no vuelve a generar salida", () => {
  assert.deepEqual(
    getLotFinalization({
      stage: "TERMINADO",
      finishedAt: new Date("2026-09-21T12:00:00.000Z"),
      totalLitersObtained: 45,
      runs: [{ type: "RECTIFICACION", status: "TERMINADA", finalLiters: 45 }],
    }),
    { ready: false, reason: "ALREADY_FINISHED" },
  );
});
