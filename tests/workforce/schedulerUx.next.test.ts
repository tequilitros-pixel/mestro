import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const experience = readFileSync(
  new URL("../../app/administration/workforce/schedule/ScheduleExperience.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/administration/workforce/schedule/page.tsx", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../../lib/workforce/scheduling/service.ts", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../app/actions/workforceScheduling.ts", import.meta.url),
  "utf8",
);

test("Scheduler defaults to the global multi-branch workspace", () => {
  assert.match(page, /query\.branch !== "all"/);
  assert.match(page, /getGlobalScheduleBoard/);
  assert.match(experience, /Todas las sucursales/);
});

test("global loading batches periods, employments and availability", () => {
  const globalBoard = service.match(/export async function getGlobalScheduleBoard[\s\S]*?export async function getPreviousWeekSchedulePreview/)?.[0] ?? "";
  assert.match(globalBoard, /Promise\.all/);
  assert.match(globalBoard, /schedulePeriod\.findMany/);
  assert.match(globalBoard, /employment\.findMany/);
  assert.match(globalBoard, /availabilityRules: true/);
  assert.match(globalBoard, /previousPeriods/);
});

test("desktop grid exposes branch, time, break and persistent add actions", () => {
  assert.match(experience, /shift\.branchName/);
  assert.match(experience, /shift\.start.*shift\.end/);
  assert.match(experience, /shift\.breakMinutes/);
  assert.match(experience, />\+ Agregar</);
  assert.doesNotMatch(experience, /opacity-0 focus:opacity-100 group-hover:opacity-100/);
});

test("Scheduler exposes search, weekly totals and employees without a branch", () => {
  assert.match(experience, /Buscar empleado/);
  assert.match(experience, /h programadas/);
  assert.match(experience, /Sin sucursal/);
  assert.match(experience, /Asignar sucursal/);
});

test("mobile uses a day selector and branch-grouped shift cards", () => {
  assert.match(experience, /Días de la semana/);
  assert.match(experience, /branchShifts/);
  assert.match(experience, /Sin turno/);
  assert.match(experience, />\+ Agregar</);
});

test("duplicate creates a new shift instead of overwriting its source", () => {
  assert.match(experience, /duplicate: true/);
  assert.match(experience, /const isEdit = Boolean\(shift && !editor\.duplicate\)/);
  assert.match(experience, /\{isEdit && <>\s*<input type="hidden" name="shiftId"/);
});

test("copy and publication preserve branch-scoped domain operations", () => {
  assert.match(experience, /action=\{publishWorkforceScheduleAction\}/);
  assert.match(experience, /name="periodId"/);
  assert.match(experience, /action=\{copyWorkforcePreviousWeekGroupAction\}/);
  assert.match(actions, /for \(const branchId of branchIds\)/);
  assert.match(actions, /ensureSchedulePeriod\(current, branchId, weekStart\)/);
  assert.match(actions, /copyPreviousScheduleWeek\(current, target\.id\)/);
});
