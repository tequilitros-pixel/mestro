import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../app/administration/workforce/schedule/ScheduleExperience.tsx", import.meta.url),
  "utf8",
);

test("Scheduler always exposes the global new-shift action and actionable empty state", () => {
  assert.match(source, />Nuevo turno</);
  assert.match(source, /No hay empleados disponibles para programar/);
  assert.match(source, /Administrar empleados/);
  assert.match(source, /Primero necesitas un empleado/);
  assert.match(source, /Ir a Empleados/);
});

test("desktop empty cells and employee rows expose visible shift actions", () => {
  assert.match(source, />\+ Turno</);
  assert.match(source, />\+ Agregar turno</);
  assert.doesNotMatch(source, /opacity-0 focus:opacity-100 group-hover:opacity-100/);
});

test("mobile cards keep an explicit add-shift action", () => {
  const mobile = source.match(/model\.employments\.length > 0[\s\S]*?unassigned\.length/)?.[0] ?? "";
  assert.match(mobile, /Sin turno/);
  assert.match(mobile, />\+ Agregar turno</);
});
