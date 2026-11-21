import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("../../app/actions/workforceEmployment.ts", import.meta.url), "utf8");
}

test("quick allowed-branch toggles use the canonical history operations", async () => {
  const actionSource = await source();
  const action = actionSource.match(/export async function toggleWorkforceAllowedBranchAction[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(action, /addBranchAssignment/);
  assert.match(action, /endAllowedBranch/);
  assert.match(action, /effectiveFrom: new Date\(\)/);
  assert.match(action, /effectiveTo: new Date\(\)/);
});

test("employee mutations stay behind workforce administrator authorization", async () => {
  const actionSource = await source();

  assert.match(actionSource, /async function authorize\(\)/);
  assert.match(actionSource, /assertWorkforceAdministrator\(user\)/);
  assert.match(actionSource, /export async function changeWorkforceEmploymentStatusAction/);
  assert.match(actionSource, /export async function changeWorkforceHomeAction/);
  assert.match(actionSource, /export async function changeWorkforcePayRateAction/);
});
