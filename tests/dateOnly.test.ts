import assert from "node:assert/strict";
import test from "node:test";
import {
  businessDayStart,
  formatBusinessDateOnly,
  lastSalesDayOfMonth,
  parseDateOnly,
} from "../lib/dateOnly";

test("el periodo mensual termina el dia 30 y respeta meses mas cortos", () => {
  assert.equal(lastSalesDayOfMonth("2026-01-15"), "2026-01-30");
  assert.equal(lastSalesDayOfMonth("2026-04-15"), "2026-04-30");
  assert.equal(lastSalesDayOfMonth("2026-02-15"), "2026-02-28");
  assert.equal(lastSalesDayOfMonth("2028-02-15"), "2028-02-29");
});

test("el inicio del dia de negocio es medianoche de Ciudad de Mexico", () => {
  const start = businessDayStart("2026-08-13");
  assert.equal(start.toISOString(), "2026-08-13T06:00:00.000Z");
  assert.equal(formatBusinessDateOnly(start), "2026-08-13");
});

test("las fechas civiles inválidas se rechazan", () => {
  assert.throws(() => parseDateOnly("2026-02-30"));
  assert.throws(() => parseDateOnly("08/13/2026"));
});
