import assert from "node:assert/strict";
import test from "node:test";
import { LotStage } from "@prisma/client";
import {
  MILLING_ALLOWED_LOT_STAGES,
  suggestedMillingCookedKg,
} from "../lib/milling/eligibleLots";

test("permite más jornadas de molienda aunque el mismo lote ya haya avanzado", () => {
  for (const stage of [
    LotStage.COCCION,
    LotStage.MOLIENDA,
    LotStage.FERMENTACION,
    LotStage.DESTILACION,
    LotStage.RECTIFICACION,
  ]) {
    assert.ok(MILLING_ALLOWED_LOT_STAGES.includes(stage), stage);
  }
  assert.ok(!MILLING_ALLOWED_LOT_STAGES.includes(LotStage.RECEPCION));
  assert.ok(!MILLING_ALLOWED_LOT_STAGES.includes(LotStage.TERMINADO));
});

test("evita sugerir los mismos kilos cocidos en cada jornada", () => {
  assert.equal(suggestedMillingCookedKg(4000, 0), 4000);
  assert.equal(suggestedMillingCookedKg(4000, 1), null);
  assert.equal(suggestedMillingCookedKg(4000, 3), null);
  assert.equal(suggestedMillingCookedKg(0, 0), null);
});
