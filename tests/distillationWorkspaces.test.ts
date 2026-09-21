import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { summarizeDistillations } from "@/lib/distillation/statistics";
import { getTotalLiters, getTailLiters } from "@/lib/services/distillation";

test("agrupa la producción por tina y conserva cada alambique", () => {
  const groups = summarizeDistillations([
    { id: "a", tankName: "Tina 1", equipmentName: "Alambique 1", loadedLiters: 800, finalLiters: 180, finalAlcohol: 50, finalHeadsLiters: 10, finalHeartLiters: 150, finalTailsLiters: 20 },
    { id: "b", tankName: "Tina 1", equipmentName: "Alambique 2", loadedLiters: 700, finalLiters: 140, finalAlcohol: 40, finalHeadsLiters: 8, finalHeartLiters: 115, finalTailsLiters: 17 },
    { id: "c", tankName: "Tina 2", equipmentName: "Alambique 3", loadedLiters: 600, finalLiters: 100, finalAlcohol: 45, finalHeadsLiters: 5, finalHeartLiters: 80, finalTailsLiters: 15 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].loadedLiters, 1500);
  assert.equal(groups[0].finalLiters, 320);
  assert.equal(groups[0].runs.length, 2);
  assert.equal(groups[0].averageAlcohol, 45.625);
  assert.equal(groups[1].tankName, "Tina 2");
});

test("el evento de cierre no duplica litros ni colas", () => {
  const events = [
    { type: "INICIO_COLAS", liters: 12 },
    { type: "OBSERVACION", liters: 8 },
    { type: "FIN_DESTILACION", liters: 100 },
  ] as never;
  assert.equal(getTotalLiters(events), 20);
  assert.equal(getTailLiters(events), 20);
});

test("la migración protege jornadas, tina única y linaje de corridas", () => {
  const sql = fs.readFileSync("prisma/migrations/20260920120000_operational_distillation_workspaces/migration.sql", "utf8");
  assert.match(sql, /MillingWorkSession_one_open_per_milling/);
  assert.match(sql, /Fermentation_one_per_lot_tank/);
  assert.match(sql, /"sourceFermentationId" TEXT/);
  assert.match(sql, /"sourceDistillationId" TEXT/);
  assert.match(sql, /BoilerProcessLink_one_open_process/);
});
