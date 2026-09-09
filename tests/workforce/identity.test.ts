import assert from "node:assert/strict";
import test from "node:test";
import { applyIdentityChange, type IdentityActor, type IdentityChange, type IdentityTx } from "../../lib/workforce/identity/operations";
import { employeeMatchesStatus, normalizeEmployeeStatusFilter } from "../../lib/workforce/employment/presentation";

function fixture() {
  const users = [
    { id: "admin", role: "ADMIN", active: true },
    { id: "employee-user", role: "OPERATOR", active: true },
    { id: "other-user", role: "OPERATOR", active: true },
  ];
  const employee = { id: "employee", active: true, userId: "employee-user" };
  const sessions = [{ userId: "employee-user" }, { userId: "employee-user" }, { userId: "other-user" }];
  const history = { employment: { status: "TERMINATED", endedAt: "2026-09-01" }, timesheet: { status: "LOCKED", minutes: 480 }, payroll: { status: "PAID", amount: "800.00" }, clock: [{ id: "original-event" }] };
  const writes: string[] = [];
  const contexts: string[] = [];
  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.find(user => user.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { active: boolean } }) => {
        const user = users.find(user => user.id === where.id)!;
        writes.push(`user:${where.id}`); Object.assign(user, data); return user;
      },
    },
    employee: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === employee.id ? { ...employee, user: users.find(user => user.id === employee.userId) } : null,
      update: async ({ data }: { data: { active: boolean } }) => { writes.push("employee"); Object.assign(employee, data); return employee; },
    },
  } as unknown as IdentityTx;
  const run = (input: IdentityChange, actor: IdentityActor = users[0]) => applyIdentityChange(tx, actor, input, {
    authorizeContext: async user => { contexts.push(user.id); },
    revokeSessions: async userId => {
      const count = sessions.filter(session => session.userId === userId).length;
      for (let index = sessions.length - 1; index >= 0; index--) if (sessions[index].userId === userId) sessions.splice(index, 1);
      return count;
    },
  });
  return { users, employee, sessions, history, writes, contexts, run };
}

test("employee deactivation changes only its operational flag", async () => {
  const f = fixture(); const before = structuredClone(f.history);
  const result = await f.run({ target: "EMPLOYEE", employeeId: "employee", active: false });
  assert.equal(f.employee.active, false); assert.equal(f.users[1].active, true);
  assert.equal(f.sessions.length, 3); assert.deepEqual(f.history, before);
  assert.deepEqual(f.writes, ["employee"]); assert.equal(result.audit.action, "EMPLOYEE_DISABLED");
});
test("inactive employee disappears from default even with ACTIVE employment", () => {
  assert.equal(employeeMatchesStatus(false, "ACTIVE", normalizeEmployeeStatusFilter(undefined)), false);
  assert.equal(employeeMatchesStatus(false, "ACTIVE", "INACTIVE"), true);
  assert.equal(employeeMatchesStatus(false, "ACTIVE", "ALL"), true);
});
test("employee reactivation does not reopen terminated employment or enable login", async () => {
  const f = fixture(); f.employee.active = false; f.users[1].active = false;
  const before = structuredClone(f.history);
  await f.run({ target: "EMPLOYEE", employeeId: "employee", active: true });
  assert.equal(f.employee.active, true); assert.equal(f.users[1].active, false); assert.deepEqual(f.history, before);
});
test("user deactivation revokes only target sessions and preserves employee and history", async () => {
  const f = fixture(); const before = structuredClone(f.history);
  const result = await f.run({ target: "USER", employeeId: "employee", userId: "employee-user", active: false, reason: "QA cleanup" });
  assert.equal(f.users[1].active, false); assert.equal(f.employee.active, true);
  assert.equal(result.revokedSessions, 2); assert.deepEqual(f.sessions, [{ userId: "other-user" }]);
  assert.deepEqual(f.history, before); assert.deepEqual(f.writes, ["user:employee-user"]);
  assert.equal(result.audit.actorId, "admin"); assert.equal(result.audit.reason, "QA cleanup");
});
test("user reactivation never recreates sessions or rehires employment", async () => {
  const f = fixture(); await f.run({ target: "USER", userId: "employee-user", active: false });
  const before = structuredClone(f.history);
  await f.run({ target: "USER", userId: "employee-user", active: true });
  assert.equal(f.users[1].active, true); assert.deepEqual(f.sessions, [{ userId: "other-user" }]); assert.deepEqual(f.history, before);
});
test("repeat disable is idempotent and still revokes leftover sessions", async () => {
  const f = fixture(); f.users[1].active = false;
  const result = await f.run({ target: "USER", userId: "employee-user", active: false, expectedActive: true });
  assert.equal(result.changed, false); assert.equal(result.revokedSessions, 2); assert.deepEqual(f.writes, []);
});
for (const role of ["OPERATOR", "GERENTE", "VIEWER"]) test(`${role} cannot mutate either identity flag`, async () => {
  const f = fixture();
  await assert.rejects(f.run({ target: "EMPLOYEE", employeeId: "employee", active: false }, { id: "employee-user", role }), /ADMIN/);
  await assert.rejects(f.run({ target: "USER", userId: "employee-user", active: false }, { id: "employee-user", role }), /ADMIN/);
  assert.deepEqual(f.writes, []); assert.deepEqual(f.contexts, []);
});
test("forged ADMIN role is checked against persisted actor before setting RLS context", async () => {
  const f = fixture(); await assert.rejects(f.run({ target: "USER", userId: "other-user", active: false }, { id: "employee-user", role: "ADMIN" }), /ADMIN activo/);
  assert.deepEqual(f.writes, []); assert.deepEqual(f.contexts, []);
});
test("inactive ADMIN is denied", async () => {
  const f = fixture(); f.users[0].active = false;
  await assert.rejects(f.run({ target: "EMPLOYEE", employeeId: "employee", active: false }), /ADMIN activo/); assert.deepEqual(f.writes, []);
});
test("linked user mismatch cannot disable another account", async () => {
  const f = fixture(); await assert.rejects(f.run({ target: "USER", employeeId: "employee", userId: "other-user", active: false }), /vinculado/); assert.deepEqual(f.writes, []);
});
test("ADMIN cannot disable their own access", async () => {
  const f = fixture(); await assert.rejects(f.run({ target: "USER", userId: "admin", active: false }), /propio acceso/); assert.deepEqual(f.writes, []);
});
test("invalid and stale state fail without writes", async () => {
  const f = fixture(); await assert.rejects(f.run({ target: "EMPLOYEE", employeeId: "employee", active: false, expectedActive: false }), /estado cambio/);
  await assert.rejects(f.run({ target: "EMPLOYEE", employeeId: "employee", active: "false" as unknown as boolean }), /no valido/); assert.deepEqual(f.writes, []);
});
test("missing linked user does not create an account", async () => {
  const f = fixture(); await assert.rejects(f.run({ target: "USER", employeeId: "employee", active: false }), /Usuario no encontrado/); assert.deepEqual(f.writes, []);
});
test("valid ADMIN is passed to existing RLS context hook", async () => {
  const f = fixture(); await f.run({ target: "EMPLOYEE", employeeId: "employee", active: false }); assert.deepEqual(f.contexts, ["admin"]);
});
