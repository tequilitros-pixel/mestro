import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pay-rate domain errors return to the employee detail instead of reaching the error boundary", async () => {
  const source = await readFile(new URL("../../app/actions/workforceEmployment.ts", import.meta.url), "utf8");
  const action = source.match(/export async function changeWorkforcePayRateAction[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(action, /try\s*{/);
  assert.match(action, /catch\s*\(cause\)/);
  assert.match(action, /redirect\(`\/administration\/workforce\/employees\/\$\{encodeURIComponent\(employeeId\)\}\?error=/);
});

test("identity archive and Employee active actions are administrative and preserve Employment history", async () => {
  const service = await readFile(new URL("../../lib/workforce/employment/service.ts", import.meta.url), "utf8");
  const action = await readFile(new URL("../../app/actions/workforceEmployment.ts", import.meta.url), "utf8");
  assert.match(service, /export async function setEmployeeActive/);
  assert.match(service, /export async function archiveEmployeeIdentity/);
  assert.match(service, /tx\.userSession\.deleteMany/);
  assert.match(service, /pinHash: null/);
  assert.match(action, /changeWorkforceEmployeeActiveAction/);
  assert.match(action, /archiveWorkforceIdentityAction/);
});
