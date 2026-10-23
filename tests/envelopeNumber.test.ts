import assert from "node:assert/strict";
import test from "node:test";
import { envelopeNumberForClose } from "../lib/cash-cuts/envelopeNumber";

test("el número de sobre usa mes y día del cierre en Ciudad de México", () => {
  assert.equal(envelopeNumberForClose("2026-08-08T18:00:00.000Z"), "08-08");
  assert.equal(envelopeNumberForClose("2026-08-15T18:00:00.000Z"), "08-15");
});

test("el cambio de día respeta la fecha de México y no agrega consecutivo", () => {
  assert.equal(envelopeNumberForClose("2026-08-16T05:59:59.000Z"), "08-15");
  assert.equal(envelopeNumberForClose("2026-08-16T06:00:00.000Z"), "08-16");
  assert.equal(envelopeNumberForClose("2027-08-15T18:00:00.000Z"), "08-15");
});
