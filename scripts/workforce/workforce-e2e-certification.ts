import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  createEmployee,
  changePayRate,
} from "../../lib/workforce/employment/service";
import {
  saveAvailabilityException,
  saveAvailabilityRule,
  getAvailabilityProfile,
} from "../../lib/workforce/availability/service";
import {
  ensureSchedulePeriod,
  createOrUpdateShift,
  publishSchedulePeriod,
} from "../../lib/workforce/scheduling/service";
import { createTestWorkforceClock } from "../../lib/workforce/clock/time";
import {
  recordClockEvent,
  requestCorrection,
  decideCorrection,
} from "../../lib/workforce/clock/service";
import { decideAttendanceException } from "../../lib/workforce/attendance/mutations";
import {
  ensureAndRecomputeTimesheet,
  addTimesheetAdjustment,
  approveTimesheet,
} from "../../lib/workforce/timesheet/service";
import {
  finalizeOvertime,
  setEmploymentJornadaPolicy,
} from "../../lib/workforce/overtime/service";
import {
  addPayrollAdjustment,
  approvePayrollLine,
  calculatePayrollLine,
  createRetroactivePayrollAdjustment,
  markPayrollPaid,
} from "../../lib/workforce/payroll/service";
import {
  createWorkforcePolicyVersion,
  resolveWorkforcePolicy,
} from "../../lib/workforce/settings/service";

const HOST = "ep-red-lake-ats4n9i7",
  runId = process.env.WORKFORCE_E2E_RUN_ID ?? "run",
  P = `wfe2ecert_${runId.replace(/[^a-z0-9_-]/gi, "")}`;
const qaPassword = process.env.WORKFORCE_E2E_PASSWORD;
const weekStart = new Date(
    runId === "run2" ? "2031-03-03T00:00:00.000Z" : "2031-02-03T00:00:00.000Z",
  ),
  weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
const ids = { user: `${P}_user` };
const admin = {
  id: ids.user,
  role: "ADMIN",
  accessibleBranchIds: null as string[] | null,
};
const clock = createTestWorkforceClock({
  initial: new Date("2031-01-06T15:00:00Z"),
});
const context = { clock, transactionTimeoutMs: 60_000 };
const day = (n: number) => new Date(weekStart.getTime() + n * 86_400_000);
async function retryTransient<T>(operation: () => Promise<T>) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      const code = (error as { code?: string }).code;
      if (
        ![
          "P2028",
          "P2034",
          "EADDRNOTAVAIL",
          "ECONNRESET",
          "ETIMEDOUT",
        ].includes(code ?? "")
      )
        throw error;
    }
  }
  throw last;
}

async function cleanup() {
  const employee = await prisma.employee.findFirst({
    where: { employeeNumber: `WFE2E-CERT-${runId}` },
    include: { employments: true },
  });
  if (!employee) {
    await prisma.userSession.deleteMany({ where: { userId: ids.user } });
    await prisma.user.updateMany({
      where: { id: ids.user },
      data: { active: false },
    });
    return;
  }
  const employmentIds = employee.employments.map((x) => x.id);
  if (
    await prisma.clockEvent.count({
      where: { employmentId: { in: employmentIds } },
    })
  ) {
    await prisma.userSession.deleteMany({ where: { userId: ids.user } });
    await prisma.user.updateMany({
      where: { id: ids.user },
      data: { active: false },
    });
    return;
  }
  const sheets = await prisma.timesheet.findMany({
      where: { employmentId: { in: employmentIds } },
      select: { id: true },
    }),
    sheetIds = sheets.map((x) => x.id);
  const payroll = await prisma.payrollLine.findMany({
      where: { employmentId: { in: employmentIds } },
      select: { id: true },
    }),
    payrollIds = payroll.map((x) => x.id);
  await prisma.workforcePayrollAdjustment.deleteMany({
    where: { originalPayrollLineId: { in: payrollIds } },
  });
  await prisma.workforcePayrollLineAdjustment.deleteMany({
    where: { payrollLineId: { in: payrollIds } },
  });
  await prisma.workforcePayrollRateSegment.deleteMany({
    where: { payrollLineId: { in: payrollIds } },
  });
  await prisma.payrollLine.deleteMany({ where: { id: { in: payrollIds } } });
  await prisma.workforceOvertimeLine.deleteMany({
    where: { calculation: { timesheetId: { in: sheetIds } } },
  });
  await prisma.workforceOvertimeCalculation.deleteMany({
    where: { timesheetId: { in: sheetIds } },
  });
  const lines = await prisma.timesheetLine.findMany({
      where: { timesheetId: { in: sheetIds } },
      select: { id: true },
    }),
    lineIds = lines.map((x) => x.id);
  await prisma.timesheetLineWorkSession.deleteMany({
    where: { timesheetLineId: { in: lineIds } },
  });
  await prisma.timesheetAdjustment.deleteMany({
    where: { timesheetLineId: { in: lineIds } },
  });
  await prisma.timesheetLine.deleteMany({ where: { id: { in: lineIds } } });
  await prisma.timesheet.deleteMany({ where: { id: { in: sheetIds } } });
  await prisma.attendanceException.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.workSessionClockEvent.deleteMany({
    where: { workSession: { employmentId: { in: employmentIds } } },
  });
  await prisma.workSession.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.clockCorrection.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.clockEvent.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  const shifts = await prisma.shift.findMany({
      where: { employmentId: { in: employmentIds } },
      select: { id: true },
    }),
    shiftIds = shifts.map((x) => x.id);
  await prisma.schedulePublicationShift.deleteMany({
    where: { shiftId: { in: shiftIds } },
  });
  await prisma.shiftRevision.deleteMany({
    where: { shiftId: { in: shiftIds } },
  });
  await prisma.shift.deleteMany({ where: { id: { in: shiftIds } } });
  await prisma.availabilityException.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.availabilityRule.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.employmentJornadaPolicy.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.payRate.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.branchAssignment.deleteMany({
    where: { employmentId: { in: employmentIds } },
  });
  await prisma.employment.deleteMany({ where: { id: { in: employmentIds } } });
  await prisma.employee.delete({ where: { id: employee.id } });
  await prisma.userSession.deleteMany({ where: { userId: ids.user } });
  await prisma.user.updateMany({
    where: { id: ids.user },
    data: { active: false },
  });
  await prisma.payrollPeriod.deleteMany({ where: { weekStart, weekEnd } });
}

async function event(
  employmentId: string,
  branchId: string,
  type: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",
  key: string,
) {
  return recordClockEvent(
    admin,
    {
      employmentId,
      branchId,
      type,
      source: "PERSONAL",
      idempotencyKey: `${P}:${key}`,
    },
    context,
  );
}
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(url.hostname.startsWith(HOST));
  assert.equal(url.pathname, "/neondb");
  assert.equal(process.env.WORKFORCE_CERTIFICATION_CLOCK, "true");
  assert.ok(
    qaPassword && qaPassword.length >= 16,
    "WORKFORCE_E2E_PASSWORD must be an ephemeral secret of at least 16 characters",
  );
  await cleanup();
  if (process.env.WORKFORCE_E2E_CLEANUP_ONLY === "1") return;
  const legacyBefore = {
    scheduled: await prisma.scheduledShift.count(),
    clock: await prisma.timeClockEntry.count(),
    overtime: await prisma.overtimeRecord.count(),
    payroll: await prisma.payrollEntry.count(),
  };
  const branches = await prisma.branch.findMany({
    where: { active: true, code: { startsWith: "QA-" } },
    orderBy: { code: "asc" },
    take: 2,
  });
  assert.equal(branches.length, 2);
  const passwordHash = await bcrypt.hash(qaPassword, 4);
  await prisma.user.upsert({
    where: { id: ids.user },
    update: { active: true, password: passwordHash, role: "ADMIN" },
    create: {
      id: ids.user,
      name: `WFE2E CERT Employee ${runId}`,
      username: P,
      email: `${P}@example.invalid`,
      password: passwordHash,
      role: "ADMIN",
      active: true,
    },
  });
  const employee = await createEmployee({
    displayName: `WFE2E CERT Employee ${runId}`,
    employeeNumber: `WFE2E-CERT-${runId}`,
    userId: ids.user,
    employment: {
      status: "ACTIVE",
      startedAt: new Date("2030-01-01Z"),
      dataConfidence: "KNOWN",
      homeBranchId: branches[0].id,
      allowedBranchIds: [branches[1].id],
      effectiveFrom: new Date("2030-01-01Z"),
      payRate: {
        rateType: "HOURLY",
        amount: 60,
        currency: "MXN",
        effectiveFrom: new Date("2030-01-01Z"),
      },
    },
  });
  const employment = await prisma.employment.findFirstOrThrow({
    where: { employeeId: employee.id },
  });
  await changePayRate({
    employmentId: employment.id,
    rateType: "HOURLY",
    amount: 65,
    currency: "MXN",
    effectiveFrom: day(3),
  });
  await setEmploymentJornadaPolicy(admin, {
    employmentId: employment.id,
    jornadaType: "DAY",
    effectiveFrom: weekStart,
  });
  for (let dow = 0; dow < 7; dow++)
    await retryTransient(() =>
      saveAvailabilityRule(admin, {
        employeeId: employee.id,
        dayOfWeek: dow,
        state: "AVAILABLE",
        startTime: "00:00",
        endTime: "23:59",
        effectiveFrom: weekStart,
      }),
    );
  await retryTransient(() =>
    saveAvailabilityException(admin, {
      employeeId: employee.id,
      date: day(2),
      state: "UNAVAILABLE",
      startTime: null,
      endTime: null,
      reason: "Certification exception",
    }),
  );
  const availability = await getAvailabilityProfile(
    admin,
    employee.id,
    weekStart,
    7,
  );
  assert.equal(availability.effective[2].availability.state, "UNAVAILABLE");
  const basePolicy = await resolveWorkforcePolicy(
    new Date(weekStart.getTime() - 86_400_000),
  );
  const policyValues = {
    companyTimezone: basePolicy.companyTimezone,
    payWeekStartsOn: basePolicy.payWeekStartsOn,
    payDay: basePolicy.payDay,
    scheduledHoursWarningMinutes: basePolicy.scheduledHoursWarningMinutes,
    preventiveOvertimeWarningMinutes:
      basePolicy.preventiveOvertimeWarningMinutes,
    allowUnassignedShiftPublication: basePolicy.allowUnassignedShiftPublication,
    allowAvailabilityWarningPublication: true,
    allowUnscheduledWork: true,
    shiftLinkProximityMinutes: basePolicy.shiftLinkProximityMinutes,
    lateGraceMinutes: 2,
    earlyDepartureGraceMinutes: basePolicy.earlyDepartureGraceMinutes,
    longBreakThresholdMinutes: basePolicy.longBreakThresholdMinutes,
    noShowThresholdMinutes: basePolicy.noShowThresholdMinutes,
    missingClockOutThresholdMinutes: basePolicy.missingClockOutThresholdMinutes,
    legalDayOrdinaryLimitMinutes: basePolicy.legalDayOrdinaryLimitMinutes,
    legalNightOrdinaryLimitMinutes: basePolicy.legalNightOrdinaryLimitMinutes,
    legalMixedOrdinaryLimitMinutes: basePolicy.legalMixedOrdinaryLimitMinutes,
    legalWeeklyDoubleLimitMinutes: basePolicy.legalWeeklyDoubleLimitMinutes,
  };
  const certPolicy =
    (await prisma.workforcePolicyVersion.findUnique({
      where: { effectiveFrom: weekStart },
    })) ??
    (await createWorkforcePolicyVersion(admin, {
      ...policyValues,
      effectiveFrom: weekStart,
      reason: "E2E certification late tolerance",
      confirmLegalChange: false,
    }));
  const periods = [
    await ensureSchedulePeriod(admin, branches[0].id, weekStart),
    await ensureSchedulePeriod(admin, branches[1].id, weekStart),
  ];
  const shifts = [];
  for (let i = 0; i < 6; i++) {
    const branchIndex = i === 4 ? 1 : 0;
    shifts.push(
      await createOrUpdateShift(
        admin,
        {
          periodId: periods[branchIndex].id,
          employmentId: employment.id,
          businessDate: day(i),
          startTime: i === 5 ? "22:00" : "09:00",
          endTime: i === 5 ? "06:00" : "19:00",
          expectedBreakMinutes: i === 5 ? 30 : 60,
          reason: "Certification connected schedule",
        },
        60_000,
      ),
    );
  }
  await retryTransient(() => publishSchedulePeriod(admin, periods[0].id));
  await retryTransient(() => publishSchedulePeriod(admin, periods[1].id));
  shifts[1] = await createOrUpdateShift(
    admin,
    {
      periodId: periods[0].id,
      shiftId: shifts[1].id,
      expectedVersion: shifts[1].version,
      employmentId: employment.id,
      businessDate: day(1),
      startTime: "10:00",
      endTime: "20:00",
      expectedBreakMinutes: 60,
      reason: "Certification post-publication revision",
    },
    60_000,
  );
  assert.equal(
    await prisma.shiftRevision.count({ where: { shiftId: shifts[1].id } }),
    2,
  );
  const clockOutIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const shift = await prisma.shift.findUniqueOrThrow({
      where: { id: shifts[i].id },
    });
    clock.set(new Date(shift.startAt.getTime() + (i === 1 ? 10 : 0) * 60_000));
    await event(employment.id, shift.branchId, "CLOCK_IN", `${i}:in`);
    clock.advanceHours(i === 5 ? 3 : 4);
    await event(employment.id, shift.branchId, "BREAK_START", `${i}:bs1`);
    clock.advanceMinutes(30);
    await event(employment.id, shift.branchId, "BREAK_END", `${i}:be1`);
    if (i === 2) {
      clock.advanceHours(1);
      await event(employment.id, shift.branchId, "BREAK_START", `${i}:bs2`);
      clock.advanceMinutes(15);
      await event(employment.id, shift.branchId, "BREAK_END", `${i}:be2`);
    }
    clock.set(new Date(shift.endAt.getTime() - (i === 3 ? 30 : 0) * 60_000));
    const out = await event(
      employment.id,
      shift.branchId,
      "CLOCK_OUT",
      `${i}:out`,
    );
    clockOutIds.push(out.event.id);
  }
  clock.set(new Date(day(6).getTime() + 18 * 3_600_000));
  await event(employment.id, branches[1].id, "CLOCK_IN", "unscheduled-in");
  clock.advanceHours(2);
  clockOutIds.push(
    (await event(employment.id, branches[1].id, "CLOCK_OUT", "unscheduled-out"))
      .event.id,
  );
  const originalOut = await prisma.clockEvent.findUniqueOrThrow({
    where: { id: clockOutIds[0] },
  });
  clock.set(new Date(day(6).getTime() + 21 * 3_600_000));
  const correction = await requestCorrection(
    admin,
    {
      type: "MODIFY_OCCURRED_TIME",
      targetClockEventId: originalOut.id,
      proposedOccurredAt: new Date(
        originalOut.deviceOccurredAt.getTime() + 30 * 60_000,
      ),
      reason: "Certification correct observed departure",
    },
    context,
  );
  await decideCorrection(
    admin,
    { correctionId: correction.id, decision: "APPROVED" },
    context,
  );
  const unchanged = await prisma.clockEvent.findUniqueOrThrow({
    where: { id: originalOut.id },
  });
  assert.equal(
    unchanged.deviceOccurredAt.toISOString(),
    originalOut.deviceOccurredAt.toISOString(),
  );
  const exceptions = await prisma.attendanceException.findMany({
    where: { employmentId: employment.id, status: "OPEN" },
  });
  assert.ok(exceptions.some((x) => x.type === "LATE_ARRIVAL"));
  assert.ok(
    exceptions.some(
      (x) => x.type === "EARLY_DEPARTURE" || x.type === "UNSCHEDULED_WORK",
    ),
  );
  for (const x of exceptions)
    await decideAttendanceException(admin, {
      exceptionId: x.id,
      decision: "DISMISSED",
      resolution: "Reviewed during E2E certification",
    });
  let sheet = await ensureAndRecomputeTimesheet(employment.id, weekStart);
  assert.equal(sheet.lines.length, 7);
  const monday = sheet.lines[0];
  await addTimesheetAdjustment(admin, {
    lineId: monday.id,
    type: "ADD_PAYABLE_TIME",
    minutes: 30,
    reason: "Certification payable adjustment",
    idempotencyKey: `${P}:ts-adjust`,
    expectedVersion: sheet.version,
  });
  sheet = await ensureAndRecomputeTimesheet(employment.id, weekStart);
  const approved = await approveTimesheet(admin, {
    timesheetId: sheet.id,
    expectedVersion: sheet.version,
    idempotencyKey: `${P}:ts-approve`,
  });
  const overtime = await finalizeOvertime(admin, {
    timesheetId: sheet.id,
    expectedTimesheetVersion: approved.timesheet.version,
  });
  assert.equal(
    overtime.calculation.ordinaryMinutes +
      overtime.calculation.doubleMinutes +
      overtime.calculation.tripleMinutes,
    overtime.calculation.approvedMinutes,
  );
  assert.ok(overtime.calculation.doubleMinutes > 0);
  const payroll = await retryTransient(() =>
    calculatePayrollLine(admin, sheet.id),
  );
  assert.equal(payroll.line?.status, "READY");
  const bonus = await prisma.workforcePayrollCategory.findFirstOrThrow({
      where: { direction: "EARNING", active: true },
    }),
    deduction = await prisma.workforcePayrollCategory.findFirstOrThrow({
      where: { direction: "DEDUCTION", active: true },
    });
  await retryTransient(() =>
    addPayrollAdjustment(admin, {
      payrollLineId: payroll.line!.id,
      categoryId: bonus.id,
      amount: "200",
      reason: "Certification earning",
      idempotencyKey: `${P}:earning`,
    }),
  );
  await retryTransient(() =>
    addPayrollAdjustment(admin, {
      payrollLineId: payroll.line!.id,
      categoryId: deduction.id,
      amount: "100",
      reason: "Certification deduction",
      idempotencyKey: `${P}:deduction`,
    }),
  );
  const ready = await prisma.payrollLine.findUniqueOrThrow({
    where: { id: payroll.line!.id },
  });
  const approvedPayroll = await retryTransient(() =>
    approvePayrollLine(admin, {
      payrollLineId: ready.id,
      expectedVersion: ready.version,
      idempotencyKey: `${P}:payroll-approve`,
    }),
  );
  const frozen = approvedPayroll.line.operationalPayable.toFixed(2);
  clock.set(new Date(day(6).getTime() + 22 * 3_600_000));
  const after = await requestCorrection(
    admin,
    {
      type: "MODIFY_OCCURRED_TIME",
      targetClockEventId: clockOutIds[4],
      proposedOccurredAt: new Date(
        (
          await prisma.clockEvent.findUniqueOrThrow({
            where: { id: clockOutIds[4] },
          })
        ).deviceOccurredAt.getTime() +
          15 * 60_000,
      ),
      reason: "Legitimate correction after payroll approval",
    },
    context,
  );
  await decideCorrection(
    admin,
    { correctionId: after.id, decision: "APPROVED" },
    context,
  );
  assert.equal(
    (
      await prisma.payrollLine.findUniqueOrThrow({ where: { id: ready.id } })
    ).operationalPayable.toFixed(2),
    frozen,
  );
  assert.equal(
    (await prisma.timesheet.findUniqueOrThrow({ where: { id: sheet.id } }))
      .requiresAdjustment,
    true,
  );
  await createRetroactivePayrollAdjustment(admin, {
    originalPayrollLineId: ready.id,
    appliedPayrollPeriodId: ready.payrollPeriodId,
    amount: "15",
    minutes: 15,
    reason: "Certification retroactive settlement",
    idempotencyKey: `${P}:retro`,
  });
  const paid = await markPayrollPaid(admin, {
    payrollLineId: ready.id,
    expectedVersion: approvedPayroll.line.version,
    idempotencyKey: `${P}:paid`,
    reference: "WFE2E-CERT",
  });
  assert.equal(paid.line.status, "PAID");
  assert.equal(paid.line.operationalPayable.toFixed(2), frozen);
  const restoreDate = new Date(weekEnd.getTime() + 86_400_000);
  if (
    !(await prisma.workforcePolicyVersion.findUnique({
      where: { effectiveFrom: restoreDate },
    }))
  )
    await createWorkforcePolicyVersion(admin, {
      ...policyValues,
      lateGraceMinutes: basePolicy.lateGraceMinutes,
      effectiveFrom: restoreDate,
      reason: "Restore approved policy after E2E certification",
      confirmLegalChange: false,
    });
  assert.equal(
    await prisma.employment.count({
      where: { employeeId: employee.id, status: "ACTIVE" },
    }),
    1,
  );
  assert.equal(
    await prisma.timesheet.count({
      where: { employmentId: employment.id, periodStart: weekStart },
    }),
    1,
  );
  assert.equal(
    await prisma.payrollLine.count({
      where: {
        employmentId: employment.id,
        payrollPeriodId: ready.payrollPeriodId,
      },
    }),
    1,
  );
  assert.equal(
    await prisma.clockEvent.count({
      where: { employmentId: employment.id, idempotencyKey: `${P}:0:in` },
    }),
    1,
  );
  assert.equal(
    (
      await prisma.workSession.findFirstOrThrow({
        where: { employmentId: employment.id, businessDate: day(5) },
      })
    ).businessDate.toISOString(),
    day(5).toISOString(),
  );
  const legacyAfter = {
    scheduled: await prisma.scheduledShift.count(),
    clock: await prisma.timeClockEntry.count(),
    overtime: await prisma.overtimeRecord.count(),
    payroll: await prisma.payrollEntry.count(),
  };
  assert.deepEqual(legacyAfter, legacyBefore);
  const result = {
    environment: "verified DEV",
    period: [
      weekStart.toISOString().slice(0, 10),
      weekEnd.toISOString().slice(0, 10),
    ],
    employeeId: employee.id,
    employmentId: employment.id,
    shiftIds: shifts.map((x) => x.id),
    clockEvents: await prisma.clockEvent.count({
      where: { employmentId: employment.id },
    }),
    corrections: await prisma.clockCorrection.count({
      where: { employmentId: employment.id, status: "APPROVED" },
    }),
    workSessions: await prisma.workSession.count({
      where: { employmentId: employment.id },
    }),
    timesheetId: sheet.id,
    overtimeId: overtime.calculation.id,
    payrollLineId: ready.id,
    policyVersion: certPolicy.version,
    ordinary: overtime.calculation.ordinaryMinutes,
    double: overtime.calculation.doubleMinutes,
    triple: overtime.calculation.tripleMinutes,
    payable: frozen,
    legacyWrites: 0,
    passed: true,
  };
  console.log(JSON.stringify(result));
  if (process.env.WORKFORCE_E2E_KEEP !== "1") await cleanup();
}
main()
  .catch(async (e) => {
    console.error(e);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(cleanupError);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
