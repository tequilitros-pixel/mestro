import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { enforceRuntimeRole } from "../../lib/runtime-role";

const role = (name = "maestro_runtime", rolsuper = false, rolbypassrls = false) => ({ current_user: name, rolsuper, rolbypassrls });
function transaction(roles: ReturnType<typeof role>[], denied = false) {
  const commands: string[] = [];
  return { commands, tx: {
    $queryRaw: async () => roles.length ? [roles.shift()] : [],
    $executeRaw: async (sql: TemplateStringsArray) => { commands.push(sql.join("")); if (denied) throw new Error("permission denied to set role"); return 0; },
  } as unknown as Prisma.TransactionClient };
}
test("runtime role already effective needs no switch", async () => {
  const { tx, commands } = transaction([role()]); await enforceRuntimeRole(tx, true); assert.deepEqual(commands, []);
});
test("restricted login assumes only fixed transaction-local runtime role", async () => {
  const { tx, commands } = transaction([role("restricted_login"), role()]); await enforceRuntimeRole(tx, true); assert.deepEqual(commands, ["SET LOCAL ROLE maestro_runtime"]);
});
test("privileged connections are rejected before any role switch", async () => {
  for (const value of [role("owner", true), role("owner", false, true)]) {
    const { tx, commands } = transaction([value]); await assert.rejects(enforceRuntimeRole(tx, true), /MUST_ENFORCE_RLS/); assert.deepEqual(commands, []);
  }
});
test("missing or unexpected effective role fails closed", async () => {
  for (const values of [[], [role("login"), role("unexpected")]]) {
    const { tx } = transaction(values); await assert.rejects(enforceRuntimeRole(tx, true), /MUST_ENFORCE_RLS/);
  }
});
test("database denied SET membership is never ignored", async () => {
  const { tx } = transaction([role("login")], true); await assert.rejects(enforceRuntimeRole(tx, true), /permission denied/);
});
test("development still rejects bypass privileges without requiring production role name", async () => {
  const { tx, commands } = transaction([role("dev_runtime")]); await enforceRuntimeRole(tx, false); assert.deepEqual(commands, []);
});
