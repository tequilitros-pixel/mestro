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
