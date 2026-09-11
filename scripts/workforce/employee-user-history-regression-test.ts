import assert from "node:assert/strict";
import { rawPrisma as prisma } from "@/lib/prisma";

const prefix = `WFHISTORYQA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const date = new Date("2026-01-05T00:00:00.000Z");
const instant = new Date("2026-01-05T15:00:00.000Z");

async function cleanup(ids: { userIds: string[]; employeeIds: string[]; branchId?: string; employmentId?: string }) {
  if (ids.employmentId) {
    await prisma.workforcePayrollAdjustment.deleteMany({ where: { originalPayrollLine: { employmentId: ids.employmentId } } }).catch(() => undefined);
    await prisma.workforcePayrollLineAdjustment.deleteMany({ where: { payrollLine: { employmentId: ids.employmentId } } }).catch(() => undefined);
    await prisma.payrollLine.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.workforceOvertimeLine.deleteMany({ where: { timesheetLine: { timesheet: { employmentId: ids.employmentId } } } });
    await prisma.workforceOvertimeCalculation.deleteMany({ where: { timesheet: { employmentId: ids.employmentId } } });
    await prisma.timesheetAdjustment.deleteMany({ where: { timesheetLine: { timesheet: { employmentId: ids.employmentId } } } });
    await prisma.timesheetLineWorkSession.deleteMany({ where: { workSession: { employmentId: ids.employmentId } } });
    await prisma.timesheetLine.deleteMany({ where: { timesheet: { employmentId: ids.employmentId } } });
    await prisma.timesheet.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.attendanceException.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.workSessionClockEvent.deleteMany({ where: { workSession: { employmentId: ids.employmentId } } });
    await prisma.workSession.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.clockGeolocationEvidence.deleteMany({ where: { clockEvent: { employmentId: ids.employmentId } } });
    await prisma.clockEvent.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.branchAssignment.deleteMany({ where: { employmentId: ids.employmentId } });
    await prisma.employment.delete({ where: { id: ids.employmentId } });
  }
  await prisma.employee.deleteMany({ where: { id: { in: ids.employeeIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: ids.userIds } } });
  await prisma.workforcePolicyVersion.deleteMany({ where: { OR: [{ changedById: { in: ids.userIds } }, { changeReason: { startsWith: "WFHISTORYQA_" } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  if (ids.branchId) await prisma.branch.delete({ where: { id: ids.branchId } });
}

async function snapshot(employmentId: string) {
  const [clock, attendance, timesheet, payroll] = await Promise.all([
    prisma.clockEvent.findMany({ where: { employmentId }, orderBy: { id: "asc" } }),
    prisma.attendanceException.findMany({ where: { employmentId }, orderBy: { id: "asc" } }),
    prisma.timesheet.findMany({ where: { employmentId }, orderBy: { id: "asc" } }),
    prisma.payrollLine.findMany({ where: { employmentId }, orderBy: { id: "asc" } }),
  ]);
  return JSON.parse(JSON.stringify({ clock, attendance, timesheet, payroll }));
}

async function main() {
  const ids = { userIds: [] as string[], employeeIds: [] as string[], branchId: undefined as string | undefined, employmentId: undefined as string | undefined };
  try {
    const [admin, userA, userB] = await Promise.all([
      prisma.user.create({ data: { name: `${prefix} Admin`, username: `${prefix}_admin`, password: "qa", role: "ADMIN" } }),
      prisma.user.create({ data: { name: `${prefix} User A`, username: `${prefix}_a`, password: "qa", role: "OPERATOR" } }),
      prisma.user.create({ data: { name: `${prefix} User B`, username: `${prefix}_b`, password: "qa", role: "OPERATOR" } }),
    ]);
    ids.userIds.push(admin.id, userA.id, userB.id);
    const branch = await prisma.branch.create({ data: { name: `${prefix} Branch`, code: `${prefix}_BR`, timezone: "America/Mexico_City", geofenceEnabled: false } });
    ids.branchId = branch.id;
    const employee = await prisma.employee.create({ data: { displayName: `${prefix} Employee`, employeeNumber: `${prefix}_EMP`, userId: userA.id, active: true } });
    ids.employeeIds.push(employee.id);
    const employment = await prisma.employment.create({ data: { employeeId: employee.id, status: "ACTIVE", startedAt: date, dataConfidence: "KNOWN" } });
    ids.employmentId = employment.id;
    await prisma.branchAssignment.create({ data: { employmentId: employment.id, branchId: branch.id, type: "HOME", effectiveFrom: date } });
    const policy = await prisma.workforcePolicyVersion.create({ data: { version: 100000 + Math.floor(Math.random() * 1000000), effectiveFrom: date, changeReason: `${prefix} policy`, changedById: admin.id } });
    const periodStart = new Date(Date.UTC(2090, 0, 1 + (Date.now() % 365)));
    const periodEnd = new Date(periodStart.getTime() + 6 * 86_400_000);
    const period = await prisma.payrollPeriod.create({ data: { weekStart: periodStart, weekEnd: periodEnd, status: "APROBADA" } });

    const clockResult = await prisma.clockEvent.create({ data: { employmentId: employment.id, branchId: branch.id, type: "CLOCK_IN", deviceOccurredAt: instant, serverReceivedAt: instant, timezone: "America/Mexico_City", source: "PERSONAL", idempotencyKey: `${prefix}_clock_in` } });
    const session = await prisma.workSession.create({ data: { employmentId: employment.id, branchId: branch.id, businessDate: date, startedAt: instant, workedMinutes: 60, breakMinutes: 0, status: "OPEN", reconstructedAt: instant } });
    const attendance = await prisma.attendanceException.create({ data: { employmentId: employment.id, branchId: branch.id, businessDate: date, workSessionId: session.id, type: "LATE", severity: "WARNING", derivationKey: `${prefix}_attendance`, fingerprint: `${prefix}_attendance`, policySnapshot: { source: "QA" }, detectedAt: instant, evaluatedAt: instant } });
    const timesheet = await prisma.timesheet.create({ data: { employmentId: employment.id, payrollPeriodId: period.id, periodStart, periodEnd, status: "APPROVED", baseWorkedMinutes: 60, effectiveMinutes: 60, sourceFingerprint: `${prefix}_timesheet` } });
    const calculation = await prisma.workforceOvertimeCalculation.create({ data: { timesheetId: timesheet.id, timesheetVersion: 1, timesheetApprovedAt: instant, approvedMinutes: 60, ordinaryMinutes: 60, doubleMinutes: 0, tripleMinutes: 0, weeklyDoubleLimitMinutes: 540, policyVersion: String(policy.version), workforcePolicyVersionId: policy.id, sourceFingerprint: `${prefix}_overtime`, calculatedById: admin.id } });
    const payroll = await prisma.payrollLine.create({ data: { payrollPeriodId: period.id, employmentId: employment.id, timesheetId: timesheet.id, overtimeCalculationId: calculation.id, status: "APPROVED", employeeNameSnapshot: `${prefix} Employee`, rateTypeSnapshot: "HOURLY", payRateAmountSnapshot: 100, currencySnapshot: "MXN", overtimeTier1Multiplier: 2, overtimeTier2Multiplier: 3, grossAmount: 100, operationalPayable: 100, timesheetVersion: 1, overtimePolicyVersion: "1", sourceFingerprint: `${prefix}_payroll` } });
    const before = await snapshot(employment.id);
    const beforeIds = { clock: clockResult.id, attendance: attendance.id, timesheet: timesheet.id, payroll: payroll.id, employeeId: employee.id, employmentId: employment.id };
    assert.equal((await prisma.user.findUnique({ where: { id: userA.id }, include: { workforceEmployee: { include: { employments: true } } } }))?.workforceEmployee?.employments[0]?.id, employment.id);
    await prisma.employee.update({ where: { id: employee.id }, data: { userId: userB.id } });
    assert.equal((await prisma.user.findUnique({ where: { id: userA.id }, include: { workforceEmployee: true } }))?.workforceEmployee, null);
    assert.equal((await prisma.user.findUnique({ where: { id: userB.id }, include: { workforceEmployee: { include: { employments: true } } } }))?.workforceEmployee?.employments[0]?.id, employment.id);
    const afterChange = await snapshot(employment.id);
    assert.deepEqual(afterChange, before);
    console.log(`HISTORY BEFORE: clock=${before.clock.length} attendance=${before.attendance.length} timesheet=${before.timesheet.length} payroll=${before.payroll.length} employeeId=${beforeIds.employeeId} employmentId=${beforeIds.employmentId}`);
    console.log("CLOCK PRESERVED: PASS — User A → User B; IDs/FKs/conteos/campos clave idénticos");
    console.log("ATTENDANCE PRESERVED: PASS — User A → User B; IDs/FKs/conteos/campos clave idénticos");
    console.log("TIMESHEET PRESERVED: PASS — User A → User B; IDs/FKs/conteos/campos clave idénticos");
    console.log("PAYROLL PRESERVED: PASS — User A → User B; IDs/FKs/conteos/campos clave idénticos");
    await prisma.employee.update({ where: { id: employee.id }, data: { userId: null } });
    assert.equal((await prisma.user.findUnique({ where: { id: userB.id }, include: { workforceEmployee: true } }))?.workforceEmployee, null);
    const afterUnlink = await snapshot(employment.id);
    assert.deepEqual(afterUnlink, before);
    console.log("AFTER UNLINK: PASS — mismos IDs/FKs/conteos/campos clave");
    console.log("CLOCK REGRESSION: PASS — contexto A correcto, B correcto tras cambio, ambos sin contexto tras unlink; Clock histórico intacto");
  } finally {
    await cleanup(ids);
    await prisma.$disconnect();
    console.log("QA CLEANUP: PASS");
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
