import assert from "node:assert/strict";
import test from "node:test";
import {
  salesPeriodDateRange,
  shiftSalesPeriodRange,
} from "../../lib/pos/salesPeriod";

test("el selector semanal usa lunes a domingo", () => {
  assert.deepEqual(salesPeriodDateRange("week", "2026-09-24"), {
    from: "2026-09-21",
    to: "2026-09-27",
  });
});

test("anterior y siguiente desplazan una semana completa", () => {
  const current = { from: "2026-09-21", to: "2026-09-27" };

  assert.deepEqual(shiftSalesPeriodRange("week", current, -1), {
    from: "2026-09-14",
    to: "2026-09-20",
  });
  assert.deepEqual(shiftSalesPeriodRange("week", current, 1), {
    from: "2026-09-28",
    to: "2026-10-04",
  });
});

test("la navegación mensual cruza el año y conserva meses comerciales completos", () => {
  assert.deepEqual(
    shiftSalesPeriodRange(
      "month",
      { from: "2026-01-01", to: "2026-01-30" },
      -1,
    ),
    { from: "2025-12-01", to: "2025-12-30" },
  );
  assert.deepEqual(
    shiftSalesPeriodRange(
      "month",
      { from: "2026-01-01", to: "2026-01-30" },
      1,
    ),
    { from: "2026-02-01", to: "2026-02-28" },
  );
});

test("la navegación diaria y personalizada conserva la longitud del rango", () => {
  assert.deepEqual(
    shiftSalesPeriodRange("day", { from: "2026-09-21", to: "2026-09-21" }, -1),
    { from: "2026-09-20", to: "2026-09-20" },
  );
  assert.deepEqual(
    shiftSalesPeriodRange("custom", { from: "2026-09-10", to: "2026-09-12" }, 1),
    { from: "2026-09-13", to: "2026-09-15" },
  );
});
