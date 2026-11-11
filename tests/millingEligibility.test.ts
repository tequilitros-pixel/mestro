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

