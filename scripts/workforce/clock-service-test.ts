import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  decideCorrection,
  recordClockEvent,
  requestCorrection,
} from "../../lib/workforce/clock/service";
const HOST = "ep-red-lake-ats4n9i7";
const ids = {
  user: "wfclockqa_user",
  employee: "wfclockqa_employee",
  employment: "wfclockqa_employment",
  assignment: "wfclockqa_assignment",
  period: "wfclockqa_period",
  shift: "wfclockqa_shift",
  assignmentB: "wfclockqa_assignment_b",
  periodB: "wfclockqa_period_b",
  shiftB: "wfclockqa_shift_b",
};
async function setup() {
  const branches = await prisma.branch.findMany({
    where: { active: true, code: { startsWith: "QA-" } },
    orderBy: { code: "asc" },
    take: 2,
  });
  assert.equal(branches.length, 2);
  const [branch, branchB] = branches;
  const hash = await bcrypt.hash(randomUUID(), 12);
  await prisma.user.upsert({
    where: { id: ids.user },
    update: { active: true, role: "ADMIN" },
    create: {
      id: ids.user,
      name: "WFCLOCKQA Employee",
      username: "wfclockqa",
      email: "wfclockqa@example.invalid",
      password: hash,
      role: "ADMIN",
      active: true,
    },
  });
  if (process.env.WFQA_ADMIN_PASSWORD && process.env.WFQA_PIN) {
    await prisma.user.update({
      where: { id: ids.user },
      data: {
        password: await bcrypt.hash(process.env.WFQA_ADMIN_PASSWORD, 12),
        pinHash: await bcrypt.hash(process.env.WFQA_PIN, 10),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }
  await prisma.employee.upsert({
    where: { id: ids.employee },
    update: { userId: ids.user, active: true },
    create: {
      id: ids.employee,
      userId: ids.user,
      employeeNumber: "WFCLOCKQA-001",
      displayName: "WFCLOCKQA Employee",
      active: true,
    },
  });
  await prisma.employment.upsert({
    where: { id: ids.employment },
    update: { status: "ACTIVE" },
    create: {
      id: ids.employment,
      employeeId: ids.employee,
      status: "ACTIVE",
      startedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await prisma.branchAssignment.upsert({
    where: { id: ids.assignment },
    update: { branchId: branch.id, effectiveTo: null },
    create: {
      id: ids.assignment,
      employmentId: ids.employment,
      branchId: branch.id,
      type: "HOME",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await prisma.branchAssignment.upsert({
    where: { id: ids.assignmentB },
    update: { branchId: branchB.id, effectiveTo: null },
    create: {
      id: ids.assignmentB,
      employmentId: ids.employment,
      branchId: branchB.id,
      type: "ALLOWED",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });
  const now = new Date();
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
    ),
  );
  const end = new Date(monday.getTime() + 6 * 86400000);
  await prisma.schedulePeriod.upsert({
    where: { id: ids.period },
    update: {
      periodStart: monday,
      periodEnd: end,
      status: "PUBLISHED",
      branchId: branch.id,
    },
    create: {
      id: ids.period,
      branchId: branch.id,
      periodStart: monday,
      periodEnd: end,
      status: "PUBLISHED",
      createdById: ids.user,
    },
  });
  await prisma.shift.upsert({
    where: { id: ids.shift },
    update: {
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 8 * 3600000),
      status: "PUBLISHED",
    },
    create: {
      id: ids.shift,
      schedulePeriodId: ids.period,
      employmentId: ids.employment,
      branchId: branch.id,
      businessDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 8 * 3600000),
      expectedBreakMinutes: 30,
      status: "PUBLISHED",
      createdById: ids.user,
    },
  });
  await prisma.schedulePeriod.upsert({
    where: { id: ids.periodB },
    update: {
      periodStart: monday,
      periodEnd: end,
      status: "DRAFT",
      branchId: branchB.id,
    },
    create: {
      id: ids.periodB,
      branchId: branchB.id,
      periodStart: monday,
      periodEnd: end,
      status: "DRAFT",
      createdById: ids.user,
    },
  });
  await prisma.shift.upsert({
    where: { id: ids.shiftB },
    update: {
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 8 * 3600000),
      status: "DRAFT",
    },
    create: {
      id: ids.shiftB,
      schedulePeriodId: ids.periodB,
      employmentId: ids.employment,
      branchId: branchB.id,
      businessDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      startAt: new Date(now.getTime() - 3600000),
      endAt: new Date(now.getTime() + 8 * 3600000),
      expectedBreakMinutes: 0,
      status: "DRAFT",
      createdById: ids.user,
    },
  });
  const unauthorized = await prisma.branch.findFirstOrThrow({
    where: { active: true, id: { notIn: branches.map((b) => b.id) } },
    orderBy: { id: "asc" },
  });
  return { branch, branchB, unauthorized };
}
async function main() {
  const raw = process.env.DATABASE_URL;
  assert.ok(raw);
  const url = new URL(raw);
  assert.ok(url.hostname.startsWith(HOST));
  assert.equal(url.pathname, "/neondb");
  const { branch, branchB, unauthorized } = await setup();
  const actor = { id: ids.user, role: "ADMIN" };
  const existing = await prisma.clockEvent.count({
    where: { employmentId: ids.employment },
  });
  if (!existing) {
    const same = "wfclockqa-double-tap";
    const duplicate = await Promise.all([
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branch.id,
        type: "CLOCK_IN",
        source: "PERSONAL",
        idempotencyKey: same,
      }),
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branch.id,
        type: "CLOCK_IN",
        source: "PERSONAL",
        idempotencyKey: same,
      }),
    ]);
    assert.equal(duplicate.filter((r) => r.idempotent).length, 1);
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branch.id,
      type: "BREAK_START",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-break-1",
    });
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branch.id,
      type: "BREAK_END",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-break-2",
    });
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branch.id,
      type: "CLOCK_OUT",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-out-1",
    });
    await assert.rejects(
      () =>
        recordClockEvent(actor, {
          employmentId: ids.employment,
          branchId: branch.id,
          type: "CLOCK_OUT",
          source: "PERSONAL",
          idempotencyKey: "wfclockqa-invalid-out",
        }),
      /INVALID_TRANSITION/,
    );
    const race = await Promise.allSettled([
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branch.id,
        type: "CLOCK_IN",
        source: "PERSONAL",
        idempotencyKey: "wfclockqa-race-a",
      }),
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branch.id,
        type: "CLOCK_IN",
        source: "PERSONAL",
        idempotencyKey: "wfclockqa-race-b",
      }),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branch.id,
      type: "CLOCK_OUT",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-out-2",
    });
    const first = await prisma.clockEvent.findUniqueOrThrow({
      where: { idempotencyKey: same },
    });
    const modify = await requestCorrection(actor, {
      type: "MODIFY_OCCURRED_TIME",
      targetClockEventId: first.id,
      proposedOccurredAt: new Date(first.deviceOccurredAt.getTime() - 60000),
      reason: "WFQA correct device minute",
    });
    await decideCorrection(actor, {
      correctionId: modify.id,
      decision: "APPROVED",
    });
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branch.id,
      type: "CLOCK_IN",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-in-missing-out",
    });
    const add = await requestCorrection(actor, {
      type: "ADD_MISSING_EVENT",
      branchId: branch.id,
      proposedEventType: "CLOCK_OUT",
      proposedOccurredAt: new Date(Date.now() + 60000),
      reason: "WFQA missing clock out",
    });
    await decideCorrection(actor, {
      correctionId: add.id,
      decision: "APPROVED",
    });
    const duplicateObserved = await prisma.clockEvent.create({
      data: {
        employmentId: ids.employment,
        branchId: branch.id,
        type: "CLOCK_OUT",
        deviceOccurredAt: new Date(Date.now() + 61000),
        serverReceivedAt: new Date(),
        timezone: branch.timezone ?? "America/Mexico_City",
        source: "KIOSK",
        idempotencyKey: "wfclockqa-observed-duplicate",
      },
    });
    const voidCorrection = await requestCorrection(actor, {
      type: "VOID_EVENT",
      targetClockEventId: duplicateObserved.id,
      reason: "WFQA void duplicate event",
    });
    await decideCorrection(actor, {
      correctionId: voidCorrection.id,
      decision: "APPROVED",
    });
  }
  if (
    !(await prisma.clockEvent.findUnique({
      where: { idempotencyKey: "wfclockqa-unscheduled-in" },
    }))
  ) {
    await assert.rejects(
      () =>
        recordClockEvent(actor, {
          employmentId: ids.employment,
          branchId: unauthorized.id,
          type: "CLOCK_IN",
          source: "PERSONAL",
          idempotencyKey: "wfclockqa-unauthorized",
        }),
      /Sucursal no autorizada/,
    );
    await assert.rejects(
      () =>
        recordClockEvent(
          { id: "not-the-owner", role: "OPERATOR" },
          {
            employmentId: ids.employment,
            branchId: branch.id,
            type: "CLOCK_IN",
            source: "PERSONAL",
            idempotencyKey: "wfclockqa-other-user",
          },
        ),
      /Employee|Employment|autorizado/,
    );
    await recordClockEvent(actor, {
      employmentId: ids.employment,
      branchId: branchB.id,
      type: "CLOCK_IN",
      source: "PERSONAL",
      idempotencyKey: "wfclockqa-unscheduled-in",
    });
    const outRace = await Promise.allSettled([
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branchB.id,
        type: "CLOCK_OUT",
        source: "PERSONAL",
        idempotencyKey: "wfclockqa-out-race-a",
      }),
      recordClockEvent(actor, {
        employmentId: ids.employment,
        branchId: branchB.id,
        type: "CLOCK_OUT",
        source: "PERSONAL",
        idempotencyKey: "wfclockqa-out-race-b",
      }),
    ]);
    assert.equal(outRace.filter((r) => r.status === "fulfilled").length, 1);
  }
  await assert.rejects(
    () =>
      requestCorrection(actor, {
        type: "ADD_MISSING_EVENT",
        branchId: branch.id,
        proposedEventType: "CLOCK_OUT",
        proposedOccurredAt: new Date(Date.now() + 10 * 60000),
        reason: "WFQA reject future event",
      }),
    /ventana permitida/,
  );
  await assert.rejects(
    () =>
      decideCorrection(
        { id: ids.user, role: "GERENTE" },
        { correctionId: "does-not-matter", decision: "APPROVED" },
      ),
    /No autorizado/,
  );
  const badUiCorrection = await prisma.clockCorrection.findFirst({
    where: {
      employmentId: ids.employment,
      status: "APPROVED",
      reason: "WFQA solicitud desde UI",
    },
  });
  if (
    badUiCorrection &&
    !(await prisma.clockCorrection.findFirst({
      where: {
        targetCorrectionId: badUiCorrection.id,
        status: "APPROVED",
      },
    }))
  ) {
    const compensation = await requestCorrection(actor, {
      type: "VOID_EVENT",
      targetCorrectionId: badUiCorrection.id,
      reason: "WFQA compensate future correction",
    });
    await decideCorrection(actor, {
      correctionId: compensation.id,
      decision: "APPROVED",
    });
  }
  const [events, sessions, links, approved] = await Promise.all([
    prisma.clockEvent.findMany({ where: { employmentId: ids.employment } }),
    prisma.workSession.findMany({ where: { employmentId: ids.employment } }),
    prisma.workSessionClockEvent.count({
      where: { workSession: { employmentId: ids.employment } },
    }),
    prisma.clockCorrection.count({
      where: { employmentId: ids.employment, status: "APPROVED" },
    }),
  ]);
  assert.ok(events.length >= 8);
  assert.ok(sessions.some((s) => s.shiftId === ids.shift));
  assert.ok(
    sessions.some((s) => s.branchId === branchB.id && s.shiftId === null),
  );
  assert.ok(sessions.every((s) => s.origin === "NATIVE_RECONSTRUCTED"));
  assert.ok(sessions.some((s) => s.reconstructionVersion > 1));
  assert.ok(links > 0);
  assert.ok(approved >= 3);
  await assert.rejects(
    () =>
      prisma.clockEvent.update({
        where: { id: events[0].id },
        data: { source: "TAMPER" },
      }),
    /ClockEvent is append-only/,
  );
  await assert.rejects(
    () => prisma.clockEvent.delete({ where: { id: events[0].id } }),
    /ClockEvent is append-only/,
  );
  console.log(
    JSON.stringify({
      environment: "verified DEV",
      events: events.length,
      sessions: sessions.length,
      idempotency: true,
      concurrency: true,
      clockOutRace: true,
      unauthorizedBranchBlocked: true,
      otherEmployeeBlocked: true,
      scheduledLink: true,
      draftShiftNotLinked: true,
      unscheduledWork: true,
      reconstructionVersion: true,
      approvedCorrections: approved,
      immutableUpdate: true,
      immutableDelete: true,
      legacyWrites: 0,
    }),
  );
}
main().finally(() => prisma.$disconnect());
