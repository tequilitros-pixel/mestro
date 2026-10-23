import assert from "node:assert/strict";
import test from "node:test";
import { getLotEngine } from "../lib/services/lotEngine";

function lot(overrides: Record<string, unknown>) {
  return {
    id: "lot-1",
    code: "PV-TEST",
    stage: "RECTIFICACION",
    agaveKg: 1000,
    art: null,
    startedAt: new Date(),
    finishedAt: null,
    totalLitersObtained: null,
    qrToken: null,
    observations: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: "user-1",
    cookings: [{ id: "c-1", status: "TERMINADA" }],
    millings: [{ id: "m-1", status: "TERMINADA" }],
    fermentations: [{ id: "f-1", status: "TERMINADA" }],
    distillations: [
      { id: "d-1", type: "DESTROZADO", status: "TERMINADA", finalLiters: 376 },
    ],
    ...overrides,
  } as Parameters<typeof getLotEngine>[0];
}

test("el resumen no confunde un destrozado terminado con un lote finalizado", () => {
  const engine = getLotEngine(lot({}));
  assert.equal(engine.status, "Listo para rectificación");
  assert.equal(engine.nextAction, "Iniciar rectificación");
  assert.equal(engine.progress, 95);
});

test("el resumen dirige al botón de cierre cuando la rectificación terminó", () => {
  const engine = getLotEngine(lot({
    stage: "TERMINADO",
    distillations: [
      { id: "d-1", type: "DESTROZADO", status: "TERMINADA", finalLiters: 150 },
      { id: "r-1", type: "RECTIFICACION", status: "TERMINADA", finalLiters: 45 },
    ],
  }));
  assert.equal(engine.status, "Listo para finalizar");
  assert.equal(engine.nextHref, "#finalizar-lote");
});

test("solo un lote con cierre persistido se muestra al cien por ciento", () => {
  const engine = getLotEngine(lot({
    stage: "TERMINADO",
    finishedAt: new Date(),
    totalLitersObtained: 45,
  }));
  assert.equal(engine.status, "Terminado");
  assert.equal(engine.progress, 100);
});
