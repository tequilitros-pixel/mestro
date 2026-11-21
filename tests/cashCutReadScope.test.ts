import assert from "node:assert/strict";
import test from "node:test";
import {
  getCashCutBranchWhere,
  getCashCutVisibilityWhere,
  getCurrentCashCutWeek,
} from "../lib/cash-cuts/readScope";

test("la semana actual de cortes es lunes a domingo", () => {
  const week = getCurrentCashCutWeek("2026-09-15");

  assert.equal(week.startDate, "2026-09-14");
  assert.equal(week.endDate, "2026-09-20");
  assert.equal(week.from.toISOString(), "2026-09-14T00:00:00.000Z");
  assert.equal(week.to.toISOString(), "2026-09-20T00:00:00.000Z");
});

test("el domingo pertenece a la misma semana que comenzó el lunes", () => {
  const week = getCurrentCashCutWeek("2026-09-20");

  assert.deepEqual(
    { startDate: week.startDate, endDate: week.endDate },
    { startDate: "2026-09-14", endDate: "2026-09-20" },
  );
});

test("un corte abierto anterior sigue visible junto con la semana actual", () => {
  const where = getCashCutVisibilityWhere("2026-09-20");

  assert.deepEqual(where, {
    OR: [
      { status: "ABIERTO" },
      {
        date: {
          gte: new Date("2026-09-14T00:00:00.000Z"),
          lte: new Date("2026-09-20T00:00:00.000Z"),
        },
      },
    ],
  });
});

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
