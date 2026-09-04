import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePilotReadiness } from "../lib/pos2/certification/readiness";
import { isPos2ContextEnabled, readPos2RolloutConfig } from "../lib/pos2/certification/rollout";

test("production rollout defaults closed", () => {
  const config = readPos2RolloutConfig({ NODE_ENV: "production" });
  assert.equal(config.mode, "DISABLED");
  assert.equal(isPos2ContextEnabled(config, "branch-a", "register-a"), false);
});

test("pilot rollout is allowlisted by branch and register", () => {
  const config = readPos2RolloutConfig({ NODE_ENV: "production", POS2_ROLLOUT_MODE: "pilot", POS2_PILOT_BRANCH_IDS: "branch-a", POS2_PILOT_REGISTER_IDS: "register-a" });
  assert.equal(isPos2ContextEnabled(config, "branch-a", "register-a"), true);
  assert.equal(isPos2ContextEnabled(config, "branch-a", "register-b"), false);
  assert.equal(isPos2ContextEnabled(config, "branch-b", "register-a"), false);
});

test("kill switch overrides allowlists and development defaults open", () => {
  assert.equal(isPos2ContextEnabled(readPos2RolloutConfig({ NODE_ENV: "development" }), "any"), true);
  assert.equal(isPos2ContextEnabled(readPos2RolloutConfig({ NODE_ENV: "production", POS2_ROLLOUT_MODE: "disabled", POS2_PILOT_BRANCH_IDS: "branch-a" }), "branch-a"), false);
});

test("readiness blocks financial drift and distinguishes operational warnings", () => {
  const clean = { migrationDrift: false, staleInProgressReceipts: 0, failedOutboxEvents: 0, processingOutboxEvents: 0, inventoryMismatches: 0, paymentMismatches: 0, orphanSales: 0, openPilotRegisters: 1 };
  assert.equal(evaluatePilotReadiness(clean).status, "PASS");
  assert.equal(evaluatePilotReadiness({ ...clean, failedOutboxEvents: 1 }).status, "WARN");
  assert.equal(evaluatePilotReadiness({ ...clean, paymentMismatches: 1 }).status, "FAIL");
});
