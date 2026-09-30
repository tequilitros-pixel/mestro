import assert from "node:assert/strict";
import test from "node:test";
import { canAccessSafeEnvelopeDate, resolveSafeEnvelopeWeek, SafeEnvelopeWeekError } from "../lib/cash-cuts/safeWeek";

const sundayNightInMexico = new Date("2026-09-28T05:30:00.000Z");

test("Caja Fuerte abre en la semana actual de Ciudad de México", () => {
  const week = resolveSafeEnvelopeWeek(null, "GERENTE", sundayNightInMexico);
  assert.equal(week.weekStart, "2026-09-21");
  assert.equal(week.from.toISOString(), "2026-09-21T00:00:00.000Z");
  assert.equal(week.toExclusive.toISOString(), "2026-09-28T00:00:00.000Z");
  const mondayCutDate = new Date("2026-09-21T00:00:00.000Z");
  const nextMondayCutDate = new Date("2026-09-28T00:00:00.000Z");
  assert.ok(mondayCutDate >= week.from && mondayCutDate < week.toExclusive);
  assert.ok(nextMondayCutDate >= week.toExclusive);
  assert.equal(week.canNavigateWeeks, false);
});

test("administración puede recorrer semanas anteriores sin ampliar otros roles", () => {
  const admin = resolveSafeEnvelopeWeek("2026-09-14", "ADMIN", sundayNightInMexico);
  assert.equal(admin.weekStart, "2026-09-14");
  assert.equal(admin.canNavigateWeeks, true);
  assert.throws(
    () => resolveSafeEnvelopeWeek("2026-09-14", "GERENTE", sundayNightInMexico),
    (error) => error instanceof SafeEnvelopeWeekError && error.code === "WEEK_OUT_OF_SCOPE",
  );
  assert.throws(
    () => resolveSafeEnvelopeWeek("2026-09-14", "ENCARGADO", sundayNightInMexico),
    (error) => error instanceof SafeEnvelopeWeekError && error.code === "WEEK_OUT_OF_SCOPE",
  );
});

test("el filtro requiere una fecha válida que sea lunes", () => {
  for (const week of ["2026-09-15", "2026-02-30", "cualquier-cosa"]) {
    assert.throws(
      () => resolveSafeEnvelopeWeek(week, "ADMIN", sundayNightInMexico),
      (error) => error instanceof SafeEnvelopeWeekError && error.code === "INVALID_WEEK",
    );
  }
});

test("un usuario de caja fuerte solo puede operar sobres de la semana actual", () => {
  const current = new Date("2026-09-21T00:00:00.000Z");
  const previous = new Date("2026-09-20T00:00:00.000Z");
  const next = new Date("2026-09-28T00:00:00.000Z");
  for (const role of ["GERENTE", "ENCARGADO", "OPERATOR", "CONSULTA"]) {
    assert.equal(canAccessSafeEnvelopeDate(role, current, sundayNightInMexico), true);
    assert.equal(canAccessSafeEnvelopeDate(role, previous, sundayNightInMexico), false);
    assert.equal(canAccessSafeEnvelopeDate(role, next, sundayNightInMexico), false);
  }
  assert.equal(canAccessSafeEnvelopeDate("ADMIN", previous, sundayNightInMexico), true);
});
