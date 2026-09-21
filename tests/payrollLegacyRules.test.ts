import assert from "node:assert/strict";
import test from "node:test";
import {
  payrollBusinessDate,
  payrollWeekInstantRange,
} from "../lib/payroll/legacyRules";

test("una entrada del jueves por la noche pertenece al jueves de Mexico", () => {
  assert.equal(payrollBusinessDate(new Date("2026-09-18T01:00:00.000Z")), "2026-09-17");
});

test("la semana de nomina usa medianoches locales como limites UTC", () => {
  const range = payrollWeekInstantRange("2026-09-14");
  assert.equal(range.start.toISOString(), "2026-09-14T06:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-21T06:00:00.000Z");
});
