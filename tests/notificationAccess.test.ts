import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedNotificationRuleRecipientRoles,
  canRoleReceiveNotification,
  canUserViewNotification,
} from "../lib/notifications/access";

test("operadores no pueden recibir alertas operativas", () => {
  assert.equal(canRoleReceiveNotification("OPERATOR", "POS"), false);
  assert.equal(canRoleReceiveNotification("OPERATOR", "INVENTORY"), false);
  assert.equal(canRoleReceiveNotification("OPERATOR", "PRODUCTION"), false);
});

test("operadores solo reciben sus avisos personales", () => {
  assert.equal(canRoleReceiveNotification("OPERATOR", "TIMECLOCK"), true);
  assert.equal(canRoleReceiveNotification("OPERATOR", "PAYROLL"), true);
  assert.equal(canRoleReceiveNotification("OPERATOR", "SYSTEM"), false);
  assert.equal(canRoleReceiveNotification("OPERATOR", "SYSTEM", { test: true }), true);
});

test("las reglas operativas solo conservan roles responsables", () => {
  assert.deepEqual(
    allowedNotificationRuleRecipientRoles(["ADMIN", "OPERATOR", "GERENTE", "CONSULTA", "ENCARGADO"]),
    ["ADMIN", "GERENTE", "ENCARGADO"],
  );
});

test("gerencia solo ve alertas operativas de sus sucursales", () => {
  assert.equal(canUserViewNotification({
    role: "GERENTE", category: "POS", metadata: { branchId: "altenango" }, branchIds: ["altenango"],
  }), true);
  assert.equal(canUserViewNotification({
    role: "GERENTE", category: "POS", metadata: { branchId: "durango" }, branchIds: ["altenango"],
  }), false);
  assert.equal(canUserViewNotification({
    role: "GERENTE", category: "INVENTORY", metadata: {}, branchIds: ["altenango"],
  }), false);
});
