import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the actual service with an in-memory transaction. Branch locks and overlap
// queries still execute; no database, Clock, payroll or attendance data is touched.
function fixture() {
  const branches = ["centro", "veliz"].map(id => ({ id, active: true, timezone: "America/Mexico_City" }));
  const employees = [
    { id: "no-home", status: "ACTIVE", branchAssignments: [] },
    { id: "home-centro", status: "ACTIVE", branchAssignments: [{ branchId: "centro", type: "HOME" }] },
  ];
  // The in-memory Prisma fixture intentionally mirrors dynamic query payloads.
  type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const shifts: Row[] = [];
  const periods = branches.map(branch => ({ id: branch.id, branchId: branch.id, branch, periodStart: new Date("2026-09-07"), periodEnd: new Date("2026-09-13"), status: "DRAFT", publications: [] }));
  const template = { active: true, branchId: "veliz", branch: branches[1], shifts: [0, 1, 3, 4, 5].map(dayOfWeek => ({ dayOfWeek, type: "TURNO", startTime: dayOfWeek >= 4 ? "17:00" : "10:00", endTime: dayOfWeek >= 4 ? "01:00" : "18:00", breakMinutes: 30 })) };
  employees.forEach(e => Object.assign(e, { employee: { displayName: e.id } }));
  const tx = {
    branch: { findUniqueOrThrow: async ({ where }: Row) => branches.find(b => b.id === where.id) },
    $queryRaw: async (_strings: unknown, id: string) => branches.filter(b => b.id === id),
    employment: { findUnique: async ({ where }: Row) => employees.find(e => e.id === where.id) },
    schedulePeriod: {
      findUnique: async ({ where }: Row) => periods.find(p => p.id === where.id),
      upsert: async ({ where }: Row) => periods.find(p => p.branchId === where.branchId_periodStart_periodEnd.branchId),
    },
    scheduleTemplate: { findUnique: async () => template },
    shift: {
      findFirst: async ({ where }: Row) => shifts.find(s => s.employmentId === where.employmentId && s.id !== where.id?.not && s.startAt < where.startAt.lt && s.endAt > where.endAt.gt),
      create: async ({ data }: Row) => { const row = { id: String(shifts.length), version: 1, revisions: [], publicationLinks: [], ...data }; shifts.push(row); return row; },
      findUnique: async ({ where }: Row) => shifts.find(s => s.id === where.id),
      findUniqueOrThrow: async ({ where }: Row) => shifts.find(s => s.id === where.id),
      updateMany: async ({ where, data }: Row) => { const row = shifts.find(s => s.id === where.id && s.version === where.version); if (!row) return { count: 0 }; Object.assign(row, data, { version: row.version + 1 }); return { count: 1 }; },
    },
  };
  const source = new URL("../../lib/workforce/scheduling/service.ts", import.meta.url);
  const realRequire = createRequire(source);
  const moduleExports = { exports: {} as Row };
  const require = (id: string) => {
    if (id === "server-only") return {};
    if (id === "@/lib/prisma") return { prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } };
    if (id === "@/lib/rls") return { setRlsContext: async () => {} };
    if (id === "@/lib/workforce/settings/service") return { resolveWorkforcePolicy: async () => ({ companyTimezone: "America/Mexico_City" }) };
    if (id === "@/lib/workforce/attendance/reconcile") return { reconcileAttendanceForEmployment: () => { throw new Error("Unexpected attendance mutation"); } };
    if (id === "@/lib/workforce/branchLifecycle") {
      const branchModule = { exports: {} as Row };
      const code = ts.transpileModule(readFileSync(new URL("../../lib/workforce/branchLifecycle.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      runInNewContext(code, { exports: branchModule.exports, require });
      return branchModule.exports;
    }
    return realRequire(id);
  };
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { exports: moduleExports.exports, require, Date, Set });
  const actor = { id: "admin", role: "ADMIN", accessibleBranchIds: [] };
  const input = { periodId: "centro", branchId: "veliz", employmentId: "no-home", businessDate: new Date("2026-09-07"), startTime: "10:00", endTime: "18:00", expectedBreakMinutes: 30 };
  return { service: moduleExports.exports, actor, input, shifts, employees, branches };
}

test("active employee without HOME and HOME Centro can create in Veliz; move and cross-branch overlap", async () => {
  const f = fixture();
  const first = await f.service.createOrUpdateShift(f.actor, f.input);
  assert.equal(first.branchId, "veliz");
  await f.service.createOrUpdateShift(f.actor, { ...f.input, employmentId: "home-centro" });
  await assert.rejects(f.service.createOrUpdateShift(f.actor, { ...f.input, branchId: "centro" }), /OVERLAPPING_SHIFT/);
  const moved = await f.service.createOrUpdateShift(f.actor, { ...f.input, periodId: "veliz", branchId: "centro", shiftId: first.id, expectedVersion: 1 });
  assert.equal(moved.branchId, "centro");
  assert.equal(f.shifts.length, 2);
});

test("active branch, active employment and actor branch permissions still enforced", async () => {
  const f = fixture();
  await assert.rejects(f.service.createOrUpdateShift({ ...f.actor, role: "OPERATOR" }, f.input), /No autorizado/);
  f.employees[0].status = "INACTIVE";
  await assert.rejects(f.service.createOrUpdateShift(f.actor, f.input), /INACTIVE_EMPLOYMENT/);
  f.employees[0].status = "ACTIVE";
  f.branches[1].active = false;
  await assert.rejects(f.service.createOrUpdateShift(f.actor, f.input), /INACTIVE_OR_UNAUTHORIZED_BRANCH/);
});

test("bulk template creates only workday DRAFT shifts for employees regardless of HOME", async () => {
  const f = fixture();
  const result = await f.service.applyScheduleTemplate(f.actor, { templateId: "template", employmentIds: ["no-home", "home-centro"], weekStart: new Date("2026-09-07") });
  assert.equal(result.created, 10);
  assert.ok(f.shifts.every(s => s.status === "DRAFT" && s.endAt > s.startAt));
  assert.ok(f.shifts.every(s => !["2026-09-09", "2026-09-13"].includes(s.businessDate.toISOString().slice(0, 10))));
});
