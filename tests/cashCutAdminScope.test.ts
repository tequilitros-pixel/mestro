import assert from "node:assert/strict";
import test from "node:test";
import {
  getCashCutBranchWhere,
  getCashCutPeriodRange,
  getCashCutRangeVisibilityWhere,
} from "../lib/cash-cuts/readScope";

test("ADMIN consulta todas las sucursales de la semana", () => {
  assert.deepEqual(getCashCutBranchWhere(null, "barra"), {});
});

test("un usuario acotado conserva solo su sucursal de trabajo", () => {
  assert.deepEqual(getCashCutBranchWhere(["barra", "centro"], "barra"), {
    branchId: "barra",
  });
});

test("un usuario acotado sin sucursal de trabajo no obtiene datos", () => {
  assert.deepEqual(getCashCutBranchWhere(["barra", "centro"], null), {
    branchId: { in: [] },
  });
});

test("calcula semana actual y semana pasada de lunes a domingo", () => {
  const current = getCashCutPeriodRange("current-week", { today: "2026-09-20" });
  const previous = getCashCutPeriodRange("last-week", { today: "2026-09-20" });

  assert.equal(current.startDate, "2026-09-14");
  assert.equal(current.endDate, "2026-09-20");
  assert.equal(previous.startDate, "2026-09-07");
  assert.equal(previous.endDate, "2026-09-13");
});

test("calcula mes, año y fechas personalizadas", () => {
  assert.deepEqual(
    getCashCutPeriodRange("current-month", { today: "2026-09-20" }),
    {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T00:00:00.000Z"),
    },
  );
  assert.equal(
    getCashCutPeriodRange("current-year", { today: "2026-09-20" }).startDate,
    "2026-01-01",
  );
  assert.equal(
    getCashCutPeriodRange("custom", { from: "2026-03-10", to: "2026-04-12" }).endDate,
    "2026-04-12",
  );
});

test("mantiene visibles los cortes abiertos fuera del periodo", () => {
  const range = getCashCutPeriodRange("last-week", { today: "2026-09-20" });

  assert.deepEqual(getCashCutRangeVisibilityWhere(range), {
    OR: [
      { status: "ABIERTO" },
      { date: { gte: range.from, lte: range.to } },
    ],
  });
});
