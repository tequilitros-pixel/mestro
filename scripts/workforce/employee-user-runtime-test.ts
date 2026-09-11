import assert from "node:assert/strict";
import { rawPrisma as prisma } from "@/lib/prisma";
import { withDatabaseActor } from "@/lib/database-context";
import {
  createAndSetEmployeeUser,
  createEmployee,
  listEligibleUsers,
  setEmployeeUser,
} from "@/lib/workforce/employment/service";

const prefix = `WFIDENTITYQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const date = new Date("2026-01-01T00:00:00.000Z");
const ids = { users: [] as string[], employees: [] as string[], sessions: [] as string[] };

async function user(username: string, active = true) {
  const row = await prisma.user.create({ data: { name: `${prefix} ${username}`, username: `${prefix}_${username}`, password: "!disabled", role: "OPERATOR", active } });
  ids.users.push(row.id);
  return row;
}

async function employee(name: string, userId?: string, active = true) {
  const row = await createEmployee({ displayName: `${prefix} ${name}`, employeeNumber: `${prefix}_${name}`, userId, active, employment: { status: "ACTIVE", startedAt: date, dataConfidence: "KNOWN", effectiveFrom: date } });
  ids.employees.push(row.id);
  return row;
}

async function cleanup() {
  await prisma.userSession.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.employment.deleteMany({ where: { employeeId: { in: ids.employees } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids.employees } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  const [users, employees, employments, sessions] = await Promise.all([
    prisma.user.count({ where: { username: { startsWith: prefix } } }),
    prisma.employee.count({ where: { employeeNumber: { startsWith: prefix } } }),
    prisma.employment.count({ where: { employee: { employeeNumber: { startsWith: prefix } } } }),
    prisma.userSession.count({ where: { userId: { in: ids.users } } }),
  ]);
  assert.deepEqual({ users, employees, employments, sessions }, { users: 0, employees: 0, employments: 0, sessions: 0 });
  console.log("QA CLEANUP: PASS");
}

async function main() {
try {
  const admin = await user("ADMIN");
  return await withDatabaseActor({ id: admin.id, role: "ADMIN" }, async () => {
  const userA = await user("A");
  const userB = await user("B");
  const userC = await user("C");
  const userX = await user("X");
  const inactiveUser = await user("INACTIVE", false);

  const employeeA = await employee("A");
  const employeeB = await employee("B");
  const employeeInactive = await employee("INACTIVE", undefined, false);
  const eligibleBefore = await listEligibleUsers();
  assert.ok(eligibleBefore.some((row) => row.id === userA.id));
  console.log("EXISTING USERS AVAILABLE / LINKED USERS EXCLUDED: PASS");

  await setEmployeeUser({ employeeId: employeeA.id, userId: userA.id });
  assert.equal((await prisma.employee.findUnique({ where: { id: employeeA.id } }))?.userId, userA.id);
  assert.ok((await listEligibleUsers(employeeA.id)).some((row) => row.id === userA.id));
  assert.ok(!(await listEligibleUsers()).some((row) => row.id === userA.id));
  console.log("ASSIGN EXISTING / RELOAD PERSISTS / CURRENT USER VISIBLE: PASS");

  await assert.rejects(() => setEmployeeUser({ employeeId: employeeB.id, userId: userA.id }), /ya está vinculado/);
  console.log("DUPLICATE BLOCK: PASS");

  const sessionA = await prisma.userSession.create({ data: { userId: userA.id, tokenHash: `${prefix}_session_a`, expiresAt: new Date(Date.now() + 3600000) } });
  ids.sessions.push(sessionA.id);
  const employmentBefore = await prisma.employment.findMany({ where: { employeeId: employeeA.id }, orderBy: { id: "asc" } });
  await setEmployeeUser({ employeeId: employeeA.id, userId: userB.id });
  assert.equal((await prisma.employee.findUnique({ where: { id: employeeA.id } }))?.userId, userB.id);
  assert.equal((await prisma.employee.findUnique({ where: { userId: userA.id } })), null);
  assert.equal(await prisma.userSession.count({ where: { id: sessionA.id } }), 0);
  assert.deepEqual(await prisma.employment.findMany({ where: { employeeId: employeeA.id }, orderBy: { id: "asc" } }), employmentBefore);
  console.log("CHANGE USER / OLD SESSION REVOKED / HISTORY PRESERVED: PASS");

  await prisma.userSession.create({ data: { userId: userB.id, tokenHash: `${prefix}_session_b`, expiresAt: new Date(Date.now() + 3600000) } });
  const resolved = await prisma.user.findUnique({ where: { id: userB.id }, include: { workforceEmployee: true } });
  assert.equal(resolved?.workforceEmployee?.id, employeeA.id);
  await setEmployeeUser({ employeeId: employeeA.id, userId: null });
  assert.equal((await prisma.employee.findUnique({ where: { id: employeeA.id } }))?.userId, null);
  assert.equal((await prisma.user.findUnique({ where: { id: userB.id }, include: { workforceEmployee: true } }))?.workforceEmployee, null);
  console.log("LOGIN -> EMPLOYEE / UNLINK REMOVES EMPLOYEE CONTEXT: PASS");

  const createdEmployee = await employee("NEW");
  const createdUser = await createAndSetEmployeeUser({ employeeId: createdEmployee.id, user: { name: `${prefix} NEWUSER`, username: `${prefix}_new`, password: "password-qa-123", role: "OPERATOR" } });
  ids.users.push(createdUser.id);
  assert.equal((await prisma.employee.findUnique({ where: { id: createdEmployee.id } }))?.userId, createdUser.id);
  console.log("CREATE NEW USER + LINK: PASS");

  const existingEmployee = await employee("EXISTING", userC.id);
  assert.equal((await prisma.user.findUnique({ where: { id: userC.id }, include: { workforceEmployee: true } }))?.workforceEmployee?.id, existingEmployee.id);
  const blankEmployee = await employee("BLANK");
  assert.equal((await prisma.employee.findUnique({ where: { id: blankEmployee.id } }))?.userId, null);
  console.log("CREATE EMPLOYEE + EXISTING USER / WITHOUT USER: PASS");

  const concurrentA = await employee("CONCURRENT_A");
  const concurrentB = await employee("CONCURRENT_B");
  const outcomes = await Promise.allSettled([
    setEmployeeUser({ employeeId: concurrentA.id, userId: userX.id }),
    setEmployeeUser({ employeeId: concurrentB.id, userId: userX.id }),
  ]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(await prisma.employee.count({ where: { userId: userX.id } }), 1);
  console.log("CONCURRENCY: PASS");

  assert.equal((await prisma.user.findUnique({ where: { id: inactiveUser.id } }))?.active, false);
  assert.equal((await prisma.employee.findUnique({ where: { id: employeeInactive.id } }))?.active, false);
  assert.equal((await prisma.employment.findFirstOrThrow({ where: { employeeId: employeeInactive.id } })).status, "ACTIVE");
  console.log("INACTIVE USER / EMPLOYEE / EMPLOYMENT PRESERVED: PASS");
  console.log("IDENTITY RUNTIME QA: PASS");
  });
} finally {
  await cleanup();
  await prisma.$disconnect();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
