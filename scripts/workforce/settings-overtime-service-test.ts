import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { createWorkforcePolicyVersion, resolveWorkforcePolicy } from "../../lib/workforce/settings/service";
import { finalizeOvertime, previewOvertime } from "../../lib/workforce/overtime/service";

const HOST = "ep-red-lake-ats4n9i7";
const P = "wfovertimeqa";
const weekStart = new Date("2030-06-03T00:00:00.000Z");
const weekEnd = new Date("2030-06-09T00:00:00.000Z");
const ids = { user: `${P}_user`, employee: `${P}_employee`, employment: `${P}_employment`, period: `${P}_period`, sheet: `${P}_sheet` };
const actor = { id: ids.user, role: "ADMIN" };

async function cleanup() {
  const calc = await prisma.workforceOvertimeCalculation.findUnique({ where: { timesheetId: ids.sheet } });
  if (calc) {
    await prisma.workforceOvertimeLine.deleteMany({ where: { calculationId: calc.id } });
    await prisma.workforceOvertimeCalculation.delete({ where: { id: calc.id } });
  }
  await prisma.timesheetLine.deleteMany({ where: { timesheetId: ids.sheet } });
  await prisma.timesheet.deleteMany({ where: { id: ids.sheet } });
  await prisma.employmentJornadaPolicy.deleteMany({ where: { employmentId: ids.employment } });
  await prisma.payrollPeriod.deleteMany({ where: { id: ids.period } });
  await prisma.employment.deleteMany({ where: { id: ids.employment } });
  await prisma.employee.deleteMany({ where: { id: ids.employee } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
}

async function main() {
  const raw = process.env.DATABASE_URL;
  assert.ok(raw);
  const url = new URL(raw);
  assert.ok(url.hostname.startsWith(HOST));
  assert.equal(url.pathname, "/neondb");
  await cleanup();
  if (process.env.WF_OVERTIME_QA_CLEANUP_ONLY === "1") return;

  const legacyBefore = await prisma.overtimeRecord.count();
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", active: true } });
  const active = await resolveWorkforcePolicy(new Date("2030-06-03"));
  assert.deepEqual(
    { late: active.lateGraceMinutes, early: active.earlyDepartureGraceMinutes, break: active.longBreakThresholdMinutes, noShow: active.noShowThresholdMinutes, missingOut: active.missingClockOutThresholdMinutes },
    { late: 5, early: 5, break: 60, noShow: 30, missingOut: 60 },
  );
  const futureDate = new Date("2090-01-01T00:00:00.000Z");
  const existingFuture = await prisma.workforcePolicyVersion.findUnique({ where: { effectiveFrom: futureDate } });
  if (!existingFuture) {
    const base = await resolveWorkforcePolicy(new Date("2089-12-31"));
    const { id: _id, version: _version, effectiveFrom: _from, legalPolicyCode: _code, changedById: _by, changedAt: _at, changeReason: _reason, criticalLegalChange: _critical, createdAt: _created, ...values } = base;
    void [_id, _version, _from, _code, _by, _at, _reason, _critical, _created];
    await assert.rejects(
      () => createWorkforcePolicyVersion({ id: admin.id, role: "OPERATOR" }, {
        ...values, effectiveFrom: futureDate, reason: "QA denied", confirmLegalChange: false,
      }),
      /No autorizado/,
    );
    await assert.rejects(
      () => createWorkforcePolicyVersion({ id: admin.id, role: "ADMIN" }, { ...values, lateGraceMinutes: -1, effectiveFrom: futureDate, reason: "QA invalid setting", confirmLegalChange: false }),
      /lateGraceMinutes/,
    );
    await assert.rejects(
      () => createWorkforcePolicyVersion({ id: admin.id, role: "ADMIN" }, { ...values, legalDayOrdinaryLimitMinutes: 481, effectiveFrom: futureDate, reason: "short", confirmLegalChange: true }),
      /razón detallada/,
    );
    await createWorkforcePolicyVersion({ id: admin.id, role: "ADMIN" }, {
      ...values,
      lateGraceMinutes: 10,
      scheduledHoursWarningMinutes: 2400,
      effectiveFrom: futureDate,
      reason: "QA future operational policy validation",
      confirmLegalChange: false,
    });
  }
  const historical = await resolveWorkforcePolicy(new Date("2030-06-03"));
  const future = await resolveWorkforcePolicy(futureDate);
  assert.equal(historical.lateGraceMinutes, 5);
  assert.equal(future.lateGraceMinutes, 10);
  assert.equal(future.scheduledHoursWarningMinutes, 2400);

  await prisma.user.create({ data: { id: ids.user, name: "WFOVERTIMEQA Admin", username: "wfovertimeqa", email: "wfovertimeqa@example.invalid", password: await bcrypt.hash("disabled", 4), role: "ADMIN", active: true } });
  await prisma.employee.create({ data: { id: ids.employee, userId: ids.user, employeeNumber: "WFOVERTIMEQA-001", displayName: "WFOVERTIMEQA Employee" } });
  await prisma.employment.create({ data: { id: ids.employment, employeeId: ids.employee, startedAt: new Date("2030-01-01"), status: "ACTIVE" } });
  await prisma.employmentJornadaPolicy.create({ data: { employmentId: ids.employment, jornadaType: "DAY", effectiveFrom: new Date("2030-01-01") } });
  await prisma.payrollPeriod.create({ data: { id: ids.period, weekStart, weekEnd } });
  await prisma.timesheet.create({ data: {
    id: ids.sheet, employmentId: ids.employment, payrollPeriodId: ids.period, periodStart: weekStart, periodEnd: weekEnd,
    status: "OPEN", version: 1, baseWorkedMinutes: 3000, adjustmentMinutes: 0, effectiveMinutes: 3000, sourceFingerprint: `${P}:source`,
  } });
  const minutes = [600, 600, 600, 600, 600, 0, 0];
  for (let index = 0; index < 7; index++)
    await prisma.timesheetLine.create({ data: { id: `${P}_line_${index}`, timesheetId: ids.sheet, businessDate: new Date(weekStart.getTime() + index * 86_400_000), workedMinutes: minutes[index], regularPayableMinutes: minutes[index], totalPayableMinutes: minutes[index], sourceFingerprint: `${P}:${index}` } });

  const preview = await previewOvertime(ids.sheet);
  assert.equal(preview.mode, "PREVIEW");
  assert.deepEqual({ approved: preview.result.approvedMinutes, ordinary: preview.result.ordinaryMinutes, double: preview.result.doubleMinutes, triple: preview.result.tripleMinutes }, { approved: 3000, ordinary: 2400, double: 540, triple: 60 });
  await assert.rejects(() => finalizeOvertime(actor, { timesheetId: ids.sheet, expectedTimesheetVersion: 1 }), /TIMESHEET_NOT_APPROVED/);
  await prisma.timesheet.update({ where: { id: ids.sheet }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: ids.user, approvedBaseMinutes: 3000, approvedAdjustmentMinutes: 0, approvedEffectiveMinutes: 3000, approvedSourceFingerprint: `${P}:source`, version: 2 } });
  await assert.rejects(() => finalizeOvertime({ ...actor, role: "OPERATOR" }, { timesheetId: ids.sheet, expectedTimesheetVersion: 2 }), /No autorizado/);
  const [one, two] = await Promise.all([
    finalizeOvertime(actor, { timesheetId: ids.sheet, expectedTimesheetVersion: 2 }),
    finalizeOvertime(actor, { timesheetId: ids.sheet, expectedTimesheetVersion: 2 }),
  ]);
  assert.equal(await prisma.workforceOvertimeCalculation.count({ where: { timesheetId: ids.sheet } }), 1);
  assert.equal(Number(one.idempotent) + Number(two.idempotent), 1);
  const final = await previewOvertime(ids.sheet);
  assert.equal(final.mode, "FINAL");
  assert.equal(final.result.policyVersion, historical.legalPolicyCode);
  assert.equal(final.result.ordinaryMinutes + final.result.doubleMinutes + final.result.tripleMinutes, final.result.approvedMinutes);
  await prisma.timesheet.update({ where: { id: ids.sheet }, data: { requiresAdjustment: true } });
  const stale = await previewOvertime(ids.sheet);
  assert.equal(stale.mode, "STALE");
  const persisted = await prisma.workforceOvertimeCalculation.findUniqueOrThrow({ where: { timesheetId: ids.sheet } });
  assert.deepEqual({ approved: persisted.approvedMinutes, ordinary: persisted.ordinaryMinutes, double: persisted.doubleMinutes, triple: persisted.tripleMinutes }, { approved: 3000, ordinary: 2400, double: 540, triple: 60 });
  assert.equal(await prisma.overtimeRecord.count(), legacyBefore);
  console.log(JSON.stringify({ environment: "verified DEV", defaultsPreserved: true, adminUpdate: true, nonAdminDenied: true, invalidRejected: true, criticalReasonRequired: true, effectiveResolution: true, historicalPolicyStable: true, openPreview: true, approvedFinal: true, staleDetected: true, finalSnapshotStable: true, concurrentSingleResult: true, idempotentFinalize: true, minuteInvariant: true, legacyWrites: 0 }));
  if (process.env.WF_OVERTIME_QA_KEEP !== "1") await cleanup();
  else {
    await prisma.timesheet.update({ where: { id: ids.sheet }, data: { requiresAdjustment: false } });
    await prisma.workforceOvertimeCalculation.update({ where: { timesheetId: ids.sheet }, data: { status: "FINAL" } });
  }
}

main().catch(async (error) => { console.error(error); try { await cleanup(); } catch {} process.exitCode = 1; }).finally(() => prisma.$disconnect());
