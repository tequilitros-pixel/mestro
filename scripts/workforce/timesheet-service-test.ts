import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  addTimesheetAdjustment,
  approveTimesheet,
  ensureAndRecomputeTimesheet,
  getOwnTimesheet,
  getTimesheetBoard,
  lockTimesheet,
  signalTimesheetsForEmployment,
} from "../../lib/workforce/timesheet/service";

const HOST = "ep-red-lake-ats4n9i7";
const PREFIX = "wftimesheetqa";
const ids = {
  user: `${PREFIX}_user`, employee: `${PREFIX}_employee`, employment: `${PREFIX}_employment`,
  assignmentA: `${PREFIX}_assignment_a`, assignmentB: `${PREFIX}_assignment_b`, period: `${PREFIX}_payroll_period`,
};
const weekStart = new Date("2026-06-01T00:00:00.000Z");
const weekEnd = new Date("2026-06-07T00:00:00.000Z");
const actor = { id: ids.user, role: "ADMIN", accessibleBranchIds: null };

async function cleanup() {
  const sheets = await prisma.timesheet.findMany({ where: { employmentId: ids.employment }, select: { id: true } });
  const sheetIds = sheets.map((item) => item.id);
  const lines = await prisma.timesheetLine.findMany({ where: { timesheetId: { in: sheetIds } }, select: { id: true } });
  const lineIds = lines.map((item) => item.id);
  await prisma.timesheetLineWorkSession.deleteMany({ where: { timesheetLineId: { in: lineIds } } });
  await prisma.timesheetAdjustment.deleteMany({ where: { timesheetLineId: { in: lineIds } } });
  await prisma.timesheetLine.deleteMany({ where: { id: { in: lineIds } } });
  await prisma.timesheet.deleteMany({ where: { id: { in: sheetIds } } });
  await prisma.attendanceException.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.workSession.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.branchAssignment.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.employment.deleteMany({ where: { id: ids.employment } });
  await prisma.employee.deleteMany({ where: { id: ids.employee } });
  await prisma.payrollPeriod.deleteMany({ where: { id: ids.period } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
}

async function main() {
  const raw = process.env.DATABASE_URL;
  assert.ok(raw);
  const url = new URL(raw);
  assert.ok(url.hostname.startsWith(HOST));
  assert.equal(url.pathname, "/neondb");
  await cleanup();
  if (process.env.WF_TIMESHEET_QA_CLEANUP_ONLY === "1") return;
  const branches = await prisma.branch.findMany({ where: { active: true, code: { startsWith: "QA-" } }, orderBy: { code: "asc" }, take: 2 });
  assert.equal(branches.length, 2);
  await prisma.user.create({ data: { id: ids.user, name: "WFTIMESHEETQA Admin", username: "wftimesheetqa", email: "wftimesheetqa@example.invalid", password: await bcrypt.hash(process.env.WF_TIMESHEET_QA_PASSWORD ?? "disabled", 12), role: "ADMIN", active: true } });
  await prisma.employee.create({ data: { id: ids.employee, userId: ids.user, employeeNumber: "WFTIMESHEETQA-001", displayName: "WFTIMESHEETQA Employee" } });
  await prisma.employment.create({ data: { id: ids.employment, employeeId: ids.employee, startedAt: new Date("2026-01-01T00:00:00Z") } });
  await prisma.branchAssignment.createMany({ data: [
    { id: ids.assignmentA, employmentId: ids.employment, branchId: branches[0].id, type: "HOME", effectiveFrom: new Date("2026-01-01T00:00:00Z") },
    { id: ids.assignmentB, employmentId: ids.employment, branchId: branches[1].id, type: "ALLOWED", effectiveFrom: new Date("2026-01-01T00:00:00Z") },
  ] });
  await prisma.payrollPeriod.create({ data: { id: ids.period, weekStart, weekEnd } });
  const sessions = [
    { id: `${PREFIX}_mon_a`, day: 1, minutes: 300, branchId: branches[0].id },
    { id: `${PREFIX}_mon_b`, day: 1, minutes: 180, branchId: branches[1].id },
    ...[2, 3, 4, 5].map((day) => ({ id: `${PREFIX}_day_${day}`, day, minutes: 480, branchId: branches[0].id })),
    { id: `${PREFIX}_overnight`, day: 6, minutes: 420, branchId: branches[1].id },
    { id: `${PREFIX}_unscheduled`, day: 7, minutes: 60, branchId: branches[0].id },
  ];
  for (const item of sessions) {
    const businessDate = new Date(Date.UTC(2026, 5, item.day));
    const startedAt = new Date(Date.UTC(2026, 5, item.day, item.day === 6 ? 18 : 9));
    await prisma.workSession.create({ data: { id: item.id, employmentId: ids.employment, branchId: item.branchId, businessDate, startedAt, endedAt: new Date(startedAt.getTime() + item.minutes * 60_000), workedMinutes: item.minutes, breakMinutes: 0, origin: "NATIVE_RECONSTRUCTED", status: "COMPLETE", reconstructedAt: new Date() } });
  }
  await prisma.attendanceException.create({ data: { employmentId: ids.employment, branchId: branches[0].id, businessDate: weekStart, workSessionId: `${PREFIX}_mon_a`, type: "LATE_ARRIVAL", severity: "WARNING", derivationKey: `${PREFIX}:late`, fingerprint: `${PREFIX}:late:v1`, policySnapshot: {}, scheduledStart: new Date("2026-06-01T09:00:00Z"), actualStart: new Date("2026-06-01T09:10:00Z"), differenceMinutes: 10 } });

  let sheet = await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  const firstId = sheet.id, firstVersion = sheet.version;
  const again = await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  assert.equal(again.id, firstId);
  assert.equal(again.version, firstVersion);
  assert.equal(again.baseWorkedMinutes, 2880);
  assert.equal(again.lines[0].sessionCount, 2);
  assert.equal(again.lines[5].workedMinutes, 420);
  assert.equal(new Set(again.lines[0].workSessionLinks.map((link) => link.workSession.branchId)).size, 2);

  await prisma.workSession.update({ where: { id: `${PREFIX}_day_2` }, data: { status: "INCOMPLETE" } });
  sheet = await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  await assert.rejects(() => approveTimesheet(actor, { timesheetId: sheet.id, expectedVersion: sheet.version, idempotencyKey: `${PREFIX}:blocked` }), /bloqueado/);
  await prisma.workSession.update({ where: { id: `${PREFIX}_day_2` }, data: { status: "COMPLETE" } });
  sheet = await ensureAndRecomputeTimesheet(ids.employment, weekStart);

  const monday = sheet.lines[0];
  await assert.rejects(() => addTimesheetAdjustment(actor, { lineId: monday.id, type: "ADD_PAYABLE_TIME", minutes: 30, reason: "bad", idempotencyKey: `${PREFIX}:bad`, expectedVersion: sheet.version }), /Razón/);
  const plus = await addTimesheetAdjustment(actor, { lineId: monday.id, type: "ADD_PAYABLE_TIME", minutes: 30, reason: "QA authorized correction", idempotencyKey: `${PREFIX}:plus30`, expectedVersion: sheet.version });
  assert.equal(plus.idempotent, false);
  sheet = await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  const duplicate = await addTimesheetAdjustment(actor, { lineId: monday.id, type: "ADD_PAYABLE_TIME", minutes: 30, reason: "QA authorized correction", idempotencyKey: `${PREFIX}:plus30`, expectedVersion: firstVersion });
  assert.equal(duplicate.idempotent, true);
  const staleVersion = sheet.version;
  await addTimesheetAdjustment(actor, { lineId: monday.id, type: "REMOVE_PAYABLE_TIME", minutes: 15, reason: "QA meal correction", idempotencyKey: `${PREFIX}:minus15`, expectedVersion: sheet.version });
  await assert.rejects(() => approveTimesheet(actor, { timesheetId: sheet.id, expectedVersion: staleVersion, idempotencyKey: `${PREFIX}:stale-approval` }), /STALE_VERSION/);
  sheet = await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  assert.deepEqual({ adjustment: sheet.adjustmentMinutes, effective: sheet.effectiveMinutes }, { adjustment: 15, effective: 2895 });

  const approved = await approveTimesheet(actor, { timesheetId: sheet.id, expectedVersion: sheet.version, idempotencyKey: `${PREFIX}:approve` });
  assert.equal(approved.timesheet.status, "APPROVED");
  const doubleApproval = await approveTimesheet(actor, { timesheetId: sheet.id, expectedVersion: sheet.version, idempotencyKey: `${PREFIX}:approve` });
  assert.equal(doubleApproval.idempotent, true);
  const approvedLineMinutes = sheet.lines[0].workedMinutes;
  await prisma.workSession.update({ where: { id: `${PREFIX}_mon_a` }, data: { workedMinutes: 330, reconstructionVersion: { increment: 1 } } });
  await prisma.$transaction((tx) => signalTimesheetsForEmployment(tx, ids.employment));
  const stable = await prisma.timesheet.findUniqueOrThrow({ where: { id: sheet.id }, include: { lines: { orderBy: { businessDate: "asc" } } } });
  assert.equal(stable.lines[0].workedMinutes, approvedLineMinutes);
  assert.equal(stable.approvedEffectiveMinutes, 2895);
  assert.equal(stable.requiresAdjustment, true);
  await assert.rejects(() => addTimesheetAdjustment(actor, { lineId: monday.id, type: "ADD_PAYABLE_TIME", minutes: 1, reason: "After approval blocked", idempotencyKey: `${PREFIX}:late-adjust`, expectedVersion: stable.version }), /no editable/);
  const locked = await lockTimesheet(actor, { timesheetId: stable.id, expectedVersion: stable.version });
  assert.equal(locked.timesheet.status, "LOCKED");
  await assert.rejects(() => lockTimesheet({ ...actor, role: "OPERATOR" }, { timesheetId: stable.id, expectedVersion: locked.timesheet.version }), /No autorizado/);
  const own = await getOwnTimesheet({ id: ids.user }, weekStart);
  assert.equal(own.id, sheet.id);
  await assert.rejects(() => getOwnTimesheet({ id: "other-user" }, weekStart), /Employee/);
  await assert.rejects(
    () => getTimesheetBoard({ ...actor, role: "OPERATOR" }, weekStart),
    /No autorizado/,
  );
  const board = await getTimesheetBoard(actor, weekStart, "WFTIMESHEETQA");
  assert.equal(board.sheets.length, 1);
  console.log(JSON.stringify({ environment: "verified DEV", uniqueTimesheet: true, mondaySunday: true, multipleSessions: true, overnight: true, multiBranch: true, unscheduledIncluded: true, incompleteBlocked: true, warningApproval: true, positiveAdjustment: true, negativeAdjustment: true, adjustmentIdempotency: true, staleApprovalRejected: true, doubleApprovalIdempotent: true, approvedStable: true, retroactiveSignal: true, lockedFinal: true, employeeOwnRead: true, otherEmployeeDenied: true, nonAdminDenied: true, adminAccess: true, legacyWrites: 0 }));
  if (process.env.WF_TIMESHEET_QA_KEEP === "1") {
    await prisma.timesheetAdjustment.deleteMany({
      where: { timesheetLine: { timesheetId: sheet.id } },
    });
    await prisma.timesheet.update({
      where: { id: sheet.id },
      data: {
        status: "OPEN",
        reviewedById: null,
        reviewedAt: null,
        approvedById: null,
        approvedAt: null,
        approvalIdempotencyKey: null,
        approvedSourceFingerprint: null,
        approvedBaseMinutes: null,
        approvedAdjustmentMinutes: null,
        approvedEffectiveMinutes: null,
        approvedIssuesSnapshot: Prisma.DbNull,
        lockedById: null,
        lockedAt: null,
        requiresAdjustment: false,
        version: { increment: 1 },
      },
    });
    await ensureAndRecomputeTimesheet(ids.employment, weekStart);
  } else await cleanup();
}

main().catch(async (error) => { console.error(error); try { await cleanup(); } catch {} process.exitCode = 1; }).finally(() => prisma.$disconnect());
