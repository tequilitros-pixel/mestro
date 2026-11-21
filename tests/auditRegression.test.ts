import assert from "node:assert/strict";
import test from "node:test";
import { getProductionVolume } from "../lib/lots/productionVolume";
import { getEffectiveLiquorBatchStatus } from "../lib/liquors/batchStatus";
import { groupCalendarWeeks } from "../lib/workforce/calendarWeeks";
import { addDaysToDateOnly, mondayOfWeek } from "../lib/dateOnly";

test("final volume overrides interim readings and all completed rectifications aggregate", () => {
  const distillations = [
    { type: "DESTROZADO", status: "TERMINADA", finalLiters: 376, heartLiters: 376 },
    { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 20, heartLiters: 100 },
    { type: "RECTIFICACION", status: "TERMINADA", finalLiters: 25, heartLiters: 90 },
  ];
  assert.equal(getProductionVolume({ stage: "TERMINADO", totalLitersObtained: 45, distillations }), 45);
  assert.equal(getProductionVolume({ stage: "TERMINADO", totalLitersObtained: null, distillations }), 45);
  assert.equal(getProductionVolume({ stage: "RECTIFICACION", totalLitersObtained: null, distillations }), null);
});

test("legacy closed volume is supported but incomplete runs do not invent output", () => {
  const run = { type: "RECTIFICACION", status: "TERMINADA", finalLiters: null, heartLiters: 540 };
  assert.equal(getProductionVolume({ stage: "TERMINADO", totalLitersObtained: null, distillations: [run] }), 540);
  assert.equal(getProductionVolume({ stage: "TERMINADO", totalLitersObtained: null, distillations: [{ ...run, heartLiters: null }] }), null);
  assert.equal(getProductionVolume({ stage: "TERMINADO", totalLitersObtained: null, distillations: [run, { ...run, status: "ACTIVA" }] }), null);
});

test("exhausted bottling is complete without altering paused or unfinished production", () => {
  const batch = { status: "EMBOTELLANDO" as const, actualLiters: 50, plannedLiters: 50, bottlings: [{ litersUsed: 30 }, { litersUsed: 20 }] };
  assert.equal(getEffectiveLiquorBatchStatus(batch), "TERMINADO");
  assert.equal(batch.status, "EMBOTELLANDO");
  assert.equal(getEffectiveLiquorBatchStatus({ ...batch, bottlings: [{ litersUsed: 20 }] }), "EMBOTELLANDO");
  assert.equal(getEffectiveLiquorBatchStatus({ ...batch, status: "PAUSADO" }), "PAUSADO");
  assert.equal(getEffectiveLiquorBatchStatus({ ...batch, status: "EN_ELABORACION" }), "EN_ELABORACION");
});

test("a 21 day calendar starting Saturday keeps every date under its actual week", () => {
  const days = Array.from({ length: 21 }, (_, i) => addDaysToDateOnly("2026-09-26", i));
  const weeks = groupCalendarWeeks(days);
  assert.deepEqual(weeks.flatMap((week) => week.days), days);
  assert.deepEqual(weeks[0].days, ["2026-09-26", "2026-09-27"]);
  for (const week of weeks) for (const day of week.days) assert.equal(mondayOfWeek(day), week.start);
  assert.equal(weeks[1].start, "2026-09-28");
});
