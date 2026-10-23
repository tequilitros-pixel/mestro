import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { deriveBoilerHorometer, deriveGasSummary, gasPercentToLiters, pressureToPsi } from "@/lib/boiler/units";
import { deriveSteamTotals, pressureSegments, reconstructSteamState } from "@/lib/boiler/state";

test("convierte tanque de gas y presión conservando PSI canónico", () => {
  assert.equal(gasPercentToLiters(37).toString(), "370");
  assert.equal(pressureToPsi("2", "KG_CM2" as never).toFixed(6), "28.446687");
});

test("deriva consumo neto sin convertir recargas en consumo", () => {
  const readings = [
    { levelPercent: 80, type: "INITIAL", occurredAt: "2026-09-08T10:00:00Z" },
    { levelPercent: 60, type: "CHECK", occurredAt: "2026-09-08T11:00:00Z" },
    { levelPercent: 90, type: "REFILL", occurredAt: "2026-09-08T12:00:00Z" },
    { levelPercent: 85, type: "FINAL", occurredAt: "2026-09-08T13:00:00Z" },
  ];
  const summary = deriveGasSummary(readings);
  assert.equal(summary.netConsumptionLiters, 250);
  assert.equal(summary.refillLiters, 300);
});

test("reconstruye vapor y calcula franjas sin inventar presión", () => {
  const intervals = [{ id: "a", state: "INYECTANDO" as never, startedAt: "2026-09-08T10:00:00Z", endedAt: "2026-09-08T11:30:00Z" }];
  assert.equal(reconstructSteamState(intervals, new Date("2026-09-08T11:00:00Z")).state, "INYECTANDO");
  const totals = deriveSteamTotals(intervals, "2026-09-08T09:00:00Z", "2026-09-08T13:00:00Z");
  assert.equal(totals.withSteamMinutes, 90);
  assert.equal(totals.withoutSteamMinutes, 150);
});

test("72% a 64% equivale exactamente a 80 litros", () => {
  const summary = deriveGasSummary([
    { levelPercent: 72, type: "INITIAL", occurredAt: "2026-09-08T10:00:00Z" },
    { levelPercent: 64, type: "FINAL", occurredAt: "2026-09-08T12:00:00Z" },
  ]);
  assert.equal(summary.netConsumptionLiters, 80);
});

test("calcula litros por minuto a partir del consumo real", () => {
  const summary = deriveGasSummary([{ levelPercent: 72, type: "INITIAL", occurredAt: "2026-09-08T10:00:00Z" }, { levelPercent: 64, type: "FINAL", occurredAt: "2026-09-08T12:00:00Z" }]);
  assert.equal(summary.litersPerHour, 40);
  assert.equal(summary.litersPerMinute, 2 / 3);
});

test("el horómetro suma sesiones y agrega solo el tiempo activo actual", () => {
  const sessions = [{ startedAt: "2026-09-08T00:00:00Z", endedAt: "2026-09-08T02:00:00Z" }, { startedAt: "2026-09-08T03:00:00Z", endedAt: "2026-09-08T06:30:00Z" }, { startedAt: "2026-09-08T07:00:00Z", endedAt: "2026-09-08T08:15:00Z" }];
  assert.equal(deriveBoilerHorometer(sessions), 6.75);
  assert.equal(deriveBoilerHorometer([...sessions, { startedAt: "2026-09-08T09:00:00Z", endedAt: null }], new Date("2026-09-08T09:30:00Z")), 7.25);
});

test("la migración impide dos sesiones abiertas del mismo equipo", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX "BoilerSession_equipment_open_key"[^;]+WHERE "endedAt" IS NULL/);
  assert.doesNotMatch(sql, /BoilerSession[^;]+processId/);
});

test("una sesión puede representar consumidores simultáneos sin índice exclusivo por lote", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  assert.match(sql, /CREATE TABLE "BoilerProcessLink"/);
  assert.match(sql, /"boilerSessionId" TEXT NOT NULL/);
  assert.doesNotMatch(sql, /UNIQUE INDEX[^\n]+BoilerProcessLink/);
});

test("la presión conserva puntos reales y segmentos separados", () => {
  const segments = pressureSegments({ id: "i", state: "INYECTANDO" as never, startedAt: "2026-09-08T10:00:00Z", endedAt: "2026-09-08T12:00:00Z", pressureReadings: [{ occurredAt: "2026-09-08T10:00:00Z", canonicalPsi: 20 }, { occurredAt: "2026-09-08T11:00:00Z", canonicalPsi: 25 }] });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].psi, 20);
  assert.equal(segments[1].from.toISOString(), "2026-09-08T11:00:00.000Z");
});

test("detener vapor deja el estado derivado en SIN_INYECCION", () => {
  const intervals = [{ id: "i", state: "INYECTANDO" as never, startedAt: "2026-09-08T10:00:00Z", endedAt: "2026-09-08T11:00:00Z" }];
  assert.equal(reconstructSteamState(intervals, new Date("2026-09-08T11:30:00Z")).state, "SIN_INYECCION");
});

test("cambiar presión no cierra el intervalo general de inyección", () => {
  const intervals = [{ id: "i", state: "INYECTANDO" as never, startedAt: "2026-09-08T10:00:00Z", endedAt: "2026-09-08T12:00:00Z" }];
  assert.equal(deriveSteamTotals(intervals, "2026-09-08T09:00:00Z", "2026-09-08T13:00:00Z").withSteamMinutes, 120);
});

test("la migración conserva presión original, unidad y PSI canónico", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  assert.match(sql, /"originalValue" DECIMAL/);
  assert.match(sql, /"originalUnit" "PressureUnit"/);
  assert.match(sql, /"canonicalPsi" DECIMAL/);
});

test("las lecturas de gas son independientes y tienen tipo", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  assert.match(sql, /CREATE TABLE "GasReading"/);
  assert.match(sql, /"type" "GasReadingType" NOT NULL/);
  assert.match(sql, /"levelLiters" DECIMAL/);
});

test("la recuperación de miel dulce no depende de MillingDischarge", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  assert.match(sql, /CREATE TABLE "SweetHoneyRecovery"/);
  assert.match(sql, /"sourceCookingId" TEXT NOT NULL/);
  assert.match(sql, /"destinationTankId" TEXT/);
  assert.doesNotMatch(sql, /MillingDischarge/);
});

test("las operaciones nuevas tienen claves únicas para reintentos", () => {
  const sql = fs.readFileSync("prisma/migrations/20260908120000_add_boiler_and_sweet_honey/migration.sql", "utf8");
  for (const model of ["BoilerSession", "BoilerEvent", "PressureReading", "GasReading", "SweetHoneyRecovery"]) {
    assert.match(sql, new RegExp(`CREATE UNIQUE INDEX "${model}_[^\"]*operationId_key"`));
  }
  assert.match(sql, /CREATE UNIQUE INDEX "SteamInjectionInterval_startOperationId_key"/);
});

test("los formularios de Caldera y vapor encolan con un solo ID y no duplican el fallback", () => {
  const form = fs.readFileSync("components/offline/OfflineOperationForm.tsx", "utf8");
  const boiler = fs.readFileSync("app/boiler/[id]/page.tsx", "utf8");
  const cooking = fs.readFileSync("app/cooking/[id]/page.tsx", "utf8");
  assert.match(form, /id: crypto\.randomUUID\(\)/);
  assert.match(form, /queued = true/);
  assert.match(form, /if \(!queued && navigator\.onLine && fallbackAction\)/);
  for (const kind of ["boiler.session.start", "boiler.session.stop", "boiler.gas.reading.create", "boiler.pressure.reading.create", "boiler.event.create", "boiler.maintenance.create", "boiler.incident.create"]) {
    assert.match(boiler, new RegExp(`kind=\"${kind.replaceAll(".", "\\.")}\"`));
  }
  for (const kind of ["steam.interval.start", "steam.pressure.create", "steam.interval.stop", "sweet-honey.recovery.create"]) {
    assert.match(cooking, new RegExp(`kind=\"${kind.replaceAll(".", "\\.")}\"`));
  }
});

test("Caldera y sync validan permisos, actor y referencias en servidor", () => {
  const layout = fs.readFileSync("app/boiler/layout.tsx", "utf8");
  const actions = fs.readFileSync("app/boiler/actions.ts", "utf8");
  const sync = fs.readFileSync("app/api/sync/operations/route.ts", "utf8");
  const service = fs.readFileSync("lib/boiler/service.ts", "utf8");
  assert.match(layout, /requireModuleAccess\("\/boiler"\)/);
  assert.match(actions, /requireModuleActionAccess\("\/boiler"\)/);
  assert.match(sync, /getCurrentUser\(\)/);
  assert.match(sync, /canUserAccessModule\(user, moduleKey\)/);
  assert.match(sync, /actorId: user\.id/);
  assert.match(service, /ensureCaldera\(tx, input\.equipmentId\)/);
  assert.match(service, /ensureCooking\(tx, input\.cookingId\)/);
});

test("el cierre de Cocimiento no exige miel dulce ni Brix", () => {
  const page = fs.readFileSync("app/cooking/[id]/page.tsx", "utf8");
  assert.match(page, /finalSweetHoneyLiters = parseOptionalNumber/);
  assert.match(page, /finalSweetHoneyBrix = parseOptionalNumber/);
  assert.doesNotMatch(page, /finalSweetHoneyLiters === null/);
  assert.doesNotMatch(page, /finalSweetHoneyBrix === null/);
});

test("los eventos históricos de Cocimiento siguen leyéndose desde la bitácora", () => {
  const page = fs.readFileSync("app/cooking/[id]/page.tsx", "utf8");
  assert.match(page, /events:\s*\{/);
  assert.match(page, /cooking\.events\.map|cooking\.events\.length/);
});
