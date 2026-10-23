import assert from "node:assert/strict";
import test from "node:test";
import { getProductionOperationModuleKey } from "../lib/offline/production";
import { formatSyncStatusLabel } from "../lib/offline/status";
import { canAccessModule } from "../lib/permission-modules";

test("sincronización de Cocimiento usa el mismo permiso que la pantalla", () => {
  assert.equal(canAccessModule("GERENTE", ["/cooking"], "/cooking"), true);
  assert.equal(canAccessModule("GERENTE", ["/milling"], "/cooking"), false);
  assert.equal(canAccessModule("OPERATOR", [], "/cooking"), true);
  assert.equal(canAccessModule("OPERATOR", ["/pos"], "/cooking"), false);
});

test("cada operación de producción exige el permiso de su pantalla", () => {
  assert.equal(getProductionOperationModuleKey("cooking.event.create"), "/cooking");
  assert.equal(getProductionOperationModuleKey("milling.discharge.create"), "/milling");
  assert.equal(getProductionOperationModuleKey("pos.sale.create"), null);
});

test("el indicador separa operaciones fallidas de las pendientes", () => {
  assert.equal(
    formatSyncStatusLabel({
      online: true,
      syncing: false,
      failed: 1,
      pending: 8,
      lastSyncedAt: null,
    }),
    "1 con error · 8 pendientes · Reintentar",
  );
});
