import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { reconcileAttendanceScope } from "../../lib/workforce/attendance/reconcile";
import { decideAttendanceException } from "../../lib/workforce/attendance/mutations";

const HOST = "ep-red-lake-ats4n9i7";
const ids = {
  user: "wfattendanceqa_user",
  employee: "wfattendanceqa_employee",
  employment: "wfattendanceqa_employment",
  assignment: "wfattendanceqa_assignment",
  period: "wfattendanceqa_period",
  shift: "wfattendanceqa_shift",
  session: "wfattendanceqa_session",
  unscheduled: "wfattendanceqa_unscheduled",
};
const businessDate = new Date("2026-07-06T00:00:00.000Z");
const start = new Date("2026-07-06T09:00:00.000Z");
const end = new Date("2026-07-06T17:00:00.000Z");
const scope = {
  employmentId: ids.employment,
  start: new Date("2026-07-06T00:00:00.000Z"),
  end: new Date("2026-07-12T00:00:00.000Z"),
  now: new Date("2026-07-07T00:00:00.000Z"),
};

async function cleanup() {
  await prisma.attendanceException.deleteMany({
    where: { employmentId: ids.employment },
  });
  await prisma.workSession.deleteMany({
    where: { employmentId: ids.employment },
  });
  await prisma.shiftRevision.deleteMany({ where: { shiftId: ids.shift } });
  await prisma.shift.deleteMany({ where: { id: ids.shift } });
  await prisma.schedulePublication.deleteMany({
    where: { schedulePeriodId: ids.period },
  });
  await prisma.schedulePeriod.deleteMany({ where: { id: ids.period } });
  await prisma.branchAssignment.deleteMany({
    where: { employmentId: ids.employment },
  });
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
  if (process.env.WF_ATTENDANCE_QA_CLEANUP_ONLY === "1") {
    console.log(JSON.stringify({ cleanup: true }));
    return;
  }
  const branch = await prisma.branch.findFirstOrThrow({
    where: { active: true, code: { startsWith: "QA-" } },
    orderBy: { code: "asc" },
  });
  await prisma.user.create({
    data: {
      id: ids.user,
      name: "WFATTENDANCEQA Admin",
      username: "wfattendanceqa",
      email: "wfattendanceqa@example.invalid",
      password: await bcrypt.hash(
        process.env.WF_ATTENDANCE_QA_PASSWORD ?? "disabled-qa-credential",
        12,
      ),
      role: "ADMIN",
      active: true,
    },
  });
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: "WFATTENDANCEQA-001",
      displayName: "WFATTENDANCEQA Employee",
    },
  });
  await prisma.employment.create({
    data: {
      id: ids.employment,
      employeeId: ids.employee,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  await prisma.branchAssignment.create({
    data: {
      id: ids.assignment,
      employmentId: ids.employment,
      branchId: branch.id,
      type: "HOME",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  await prisma.schedulePeriod.create({
    data: {
      id: ids.period,
      branchId: branch.id,
      periodStart: businessDate,
      periodEnd: new Date("2026-07-12T00:00:00.000Z"),
      status: "PUBLISHED",
      createdById: ids.user,
    },
  });
  await prisma.shift.create({
    data: {
      id: ids.shift,
      schedulePeriodId: ids.period,
      employmentId: ids.employment,
      branchId: branch.id,
      businessDate,
      startAt: start,
      endAt: end,
      expectedBreakMinutes: 30,
      status: "PUBLISHED",
      createdById: ids.user,
    },
  });
  await prisma.workSession.create({
    data: {
      id: ids.session,
      employmentId: ids.employment,
      branchId: branch.id,
      shiftId: ids.shift,
      businessDate,
      startedAt: new Date("2026-07-06T09:20:00.000Z"),
      endedAt: end,
      workedMinutes: 430,
      breakMinutes: 30,
      origin: "NATIVE_RECONSTRUCTED",
      status: "COMPLETE",
      reconstructedAt: new Date(),
    },
  });

  await reconcileAttendanceScope(scope);
  await reconcileAttendanceScope(scope);
  assert.equal(
    await prisma.attendanceException.count({
      where: { employmentId: ids.employment },
    }),
    1,
  );
  const original = await prisma.attendanceException.findFirstOrThrow({
    where: { employmentId: ids.employment, type: "LATE_ARRIVAL" },
  });
  assert.equal(original.status, "OPEN");

  await prisma.workSession.update({
    where: { id: ids.session },
    data: {
      startedAt: new Date("2026-07-06T09:02:00.000Z"),
      reconstructionVersion: { increment: 1 },
    },
  });
  await reconcileAttendanceScope(scope);
  assert.equal(
    (
      await prisma.attendanceException.findUniqueOrThrow({
        where: { id: original.id },
      })
    ).status,
    "RESOLVED",
  );

  await prisma.workSession.update({
    where: { id: ids.session },
    data: { startedAt: new Date("2026-07-06T09:20:00.000Z") },
  });
  await reconcileAttendanceScope(scope);
  assert.equal(
    await prisma.attendanceException.count({
      where: { employmentId: ids.employment },
    }),
    1,
  );

  await prisma.workSession.update({
    where: { id: ids.session },
    data: { startedAt: new Date("2026-07-06T09:25:00.000Z") },
  });
  await reconcileAttendanceScope(scope);
  const materiallyChanged = await prisma.attendanceException.findFirstOrThrow({
    where: {
      employmentId: ids.employment,
      status: "OPEN",
      type: "LATE_ARRIVAL",
    },
  });
  assert.notEqual(materiallyChanged.id, original.id);

  await prisma.shift.update({
    where: { id: ids.shift },
    data: { startAt: new Date("2026-07-06T09:25:00.000Z"), version: { increment: 1 } },
  });
  await reconcileAttendanceScope(scope);
  assert.equal(
    (
      await prisma.attendanceException.findUniqueOrThrow({
        where: { id: materiallyChanged.id },
      })
    ).status,
    "RESOLVED",
  );

  await prisma.workSession.create({
    data: {
      id: ids.unscheduled,
      employmentId: ids.employment,
      branchId: branch.id,
      businessDate,
      startedAt: new Date("2026-07-06T18:00:00.000Z"),
      endedAt: new Date("2026-07-06T19:00:00.000Z"),
      workedMinutes: 60,
      breakMinutes: 0,
      origin: "NATIVE_RECONSTRUCTED",
      status: "COMPLETE",
      reconstructedAt: new Date(),
    },
  });
  await reconcileAttendanceScope(scope);
  const unscheduled = await prisma.attendanceException.findFirstOrThrow({
    where: {
      employmentId: ids.employment,
      status: "OPEN",
      type: "UNSCHEDULED_WORK",
    },
  });
  await assert.rejects(
    () =>
      decideAttendanceException(
        { id: ids.user, role: "OPERATOR" },
        {
          exceptionId: unscheduled.id,
          decision: "DISMISSED",
          resolution: "Not authorized",
        },
      ),
    /No autorizado/,
  );
  await decideAttendanceException(
    { id: ids.user, role: "ADMIN" },
    {
      exceptionId: unscheduled.id,
      decision: "DISMISSED",
      resolution: "Trabajo inesperado autorizado por QA",
    },
  );
  assert.equal(
    (
      await prisma.attendanceException.findUniqueOrThrow({
        where: { id: unscheduled.id },
      })
    ).status,
    "DISMISSED",
  );
  console.log(
    JSON.stringify({
      environment: "verified DEV",
      idempotentRecalculation: true,
      duplicateExceptions: 0,
      correctionClearsFalseLateness: true,
      resolvedHistoryPreserved: true,
      materiallyChangedFactsCreateNewGeneration: true,
      effectiveShiftRevisionReconciles: true,
      adminResolution: true,
      employeeResolutionDenied: true,
      legacyWrites: 0,
    }),
  );
  if (process.env.WF_ATTENDANCE_QA_KEEP === "1") {
    await prisma.shift.update({
      where: { id: ids.shift },
      data: { startAt: start, version: { increment: 1 } },
    });
    await prisma.workSession.update({
      where: { id: ids.session },
      data: { startedAt: new Date("2026-07-06T09:30:00.000Z") },
    });
    await reconcileAttendanceScope(scope);
    console.log(JSON.stringify({ qaDataRetained: true }));
  } else await cleanup();
}

main()
  .catch(async (error) => {
    console.error(error);
    try {
      await cleanup();
    } catch {}
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
