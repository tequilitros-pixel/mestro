import assert from "node:assert/strict";
import { prisma } from "../../lib/prisma";
import {
  copyPreviousScheduleWeek,
  createOrUpdateShift,
  deleteOrCancelShift,
  ensureSchedulePeriod,
  getScheduleBoard,
  publishSchedulePeriod,
  upsertStaffingRequirement,
  type SchedulingActor,
} from "../../lib/workforce/scheduling/service";

const HOST = "ep-red-lake-ats4n9i7";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
async function cleanup(branchIds: string[]) {
  const periods = await prisma.schedulePeriod.findMany({
    where: {
      branchId: { in: branchIds },
      periodStart: { gte: day("2030-01-07"), lte: day("2030-01-21") },
    },
    select: { id: true },
  });
  const ids = periods.map((item) => item.id);
  if (!ids.length) return;
  const shifts = await prisma.shift.findMany({
    where: { schedulePeriodId: { in: ids } },
    select: { id: true },
  });
  const shiftIds = shifts.map((item) => item.id);
  await prisma.schedulePublicationShift.deleteMany({
    where: { shiftId: { in: shiftIds } },
  });
  await prisma.schedulePublication.deleteMany({
    where: { schedulePeriodId: { in: ids } },
  });
  await prisma.shiftRevision.deleteMany({
    where: { shiftId: { in: shiftIds } },
  });
  await prisma.shift.deleteMany({ where: { id: { in: shiftIds } } });
  await prisma.staffingRequirement.deleteMany({
    where: {
      branchId: { in: branchIds },
      businessDate: { gte: day("2030-01-07"), lte: day("2030-01-27") },
    },
  });
  await prisma.schedulePeriod.deleteMany({ where: { id: { in: ids } } });
}
async function main() {
  const raw = process.env.DATABASE_URL;
  assert.ok(raw);
  const url = new URL(raw);
  assert.ok(url.hostname.startsWith(HOST));
  const actorUser = await prisma.user.findFirst({
    where: {
      active: true,
      name: { startsWith: "QA " },
      NOT: { id: { startsWith: "wfqa_auth_" } },
    },
    orderBy: { id: "asc" },
  });
  assert.ok(actorUser);
  const actor: SchedulingActor = {
    id: actorUser.id,
    role: "ADMIN",
    accessibleBranchIds: null,
  };
  const active = await prisma.employment.findUnique({
    where: { id: "wfqa_employment_01" },
    include: {
      branchAssignments: {
        where: { effectiveTo: null },
        select: { branchId: true },
        orderBy: { type: "desc" },
      },
    },
  });
  const unknown = await prisma.employment.findFirst({
    where: { id: "wfqa_employment_02" },
  });
  const inactive = await prisma.employment.findFirst({
    where: { id: "wfqa_employment_05" },
  });
  assert.ok(active && unknown && inactive);
  const branchIds = [
    ...new Set(active.branchAssignments.map((item) => item.branchId)),
  ];
  assert.equal(branchIds.length, 2);
  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    orderBy: { code: "asc" },
  });
  assert.equal(branches.length, 2);
  const singleBranchEmployment = await prisma.employment.findFirst({
    where: { id: "wfqa_employment_03" },
    include: {
      branchAssignments: {
        where: { effectiveTo: null },
        select: { branchId: true },
      },
    },
  });
  assert.ok(singleBranchEmployment);
  const unauthorizedBranch = branches.find(
    (branch) =>
      !singleBranchEmployment.branchAssignments.some(
        (assignment) => assignment.branchId === branch.id,
      ),
  );
  assert.ok(unauthorizedBranch);
  await cleanup(branches.map((item) => item.id));
  try {
    const periodA = await ensureSchedulePeriod(
      actor,
      branches[0].id,
      day("2030-01-07"),
    );
    const periodB = await ensureSchedulePeriod(
      actor,
      branches[1].id,
      day("2030-01-07"),
    );
    const unassigned = await createOrUpdateShift(actor, {
      periodId: periodA.id,
      employmentId: null,
      businessDate: day("2030-01-07"),
      startTime: "09:00",
      endTime: "17:00",
      expectedBreakMinutes: 30,
    });
    assert.equal(unassigned.employmentId, null);
    const assigned = await createOrUpdateShift(actor, {
      periodId: periodA.id,
      employmentId: active.id,
      businessDate: day("2030-01-08"),
      startTime: "09:00",
      endTime: "17:00",
      expectedBreakMinutes: 30,
    });
    assert.equal(assigned.status, "DRAFT");
    const edited = await createOrUpdateShift(actor, {
      periodId: periodA.id,
      shiftId: assigned.id,
      expectedVersion: assigned.version,
      employmentId: active.id,
      businessDate: day("2030-01-08"),
      startTime: "10:00",
      endTime: "18:00",
      expectedBreakMinutes: 30,
    });
    assert.equal(edited.version, 2);
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: periodA.id,
          shiftId: assigned.id,
          expectedVersion: 1,
          employmentId: active.id,
          businessDate: day("2030-01-08"),
          startTime: "11:00",
          endTime: "19:00",
          expectedBreakMinutes: 30,
        }),
      /STALE_VERSION/,
    );
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: periodA.id,
          employmentId: active.id,
          businessDate: day("2030-01-08"),
          startTime: "12:00",
          endTime: "16:00",
          expectedBreakMinutes: 0,
        }),
      /OVERLAPPING_SHIFT/,
    );
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: periodB.id,
          employmentId: active.id,
          businessDate: day("2030-01-08"),
          startTime: "12:00",
          endTime: "20:00",
          expectedBreakMinutes: 0,
        }),
      /OVERLAPPING_SHIFT/,
    );
    const unauthorizedPeriod =
      unauthorizedBranch.id === periodA.branchId ? periodA : periodB;
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: unauthorizedPeriod.id,
          employmentId: singleBranchEmployment.id,
          businessDate: day("2030-01-09"),
          startTime: "09:00",
          endTime: "17:00",
          expectedBreakMinutes: 0,
        }),
      /UNAUTHORIZED_BRANCH/,
    );
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: periodA.id,
          employmentId: inactive.id,
          businessDate: day("2030-01-09"),
          startTime: "09:00",
          endTime: "17:00",
          expectedBreakMinutes: 0,
        }),
      /INACTIVE_EMPLOYMENT/,
    );
    await upsertStaffingRequirement(actor, {
      branchId: branches[0].id,
      businessDate: day("2030-01-07"),
      startTime: "09:00",
      endTime: "17:00",
      requiredCount: 2,
    });
    const board = await getScheduleBoard(
      actor,
      branches[0].id,
      day("2030-01-07"),
    );
    assert.equal(board.coverage[0].status, "UNDERSTAFFED");
    assert.ok(board.shiftWarnings.get(unassigned.id)?.includes("UNASSIGNED"));
    const deletable = await createOrUpdateShift(actor, {
      periodId: periodA.id,
      employmentId: unknown.id,
      businessDate: day("2030-01-10"),
      startTime: "09:00",
      endTime: "17:00",
      expectedBreakMinutes: 0,
    });
    assert.deepEqual(
      await deleteOrCancelShift(actor, {
        shiftId: deletable.id,
        expectedVersion: deletable.version,
      }),
      { deleted: true, cancelled: false },
    );
    const expectedSnapshots = await prisma.shift.count({
      where: { schedulePeriodId: periodA.id, status: "DRAFT" },
    });
    const publication = await publishSchedulePeriod(actor, periodA.id);
    assert.equal(publication.idempotent, false);
    const duplicate = await publishSchedulePeriod(actor, periodA.id);
    assert.equal(duplicate.id, publication.id);
    assert.equal(duplicate.idempotent, true);
    const publishedShift = await prisma.shift.findUniqueOrThrow({
      where: { id: assigned.id },
    });
    await assert.rejects(
      () =>
        createOrUpdateShift(actor, {
          periodId: periodA.id,
          shiftId: assigned.id,
          expectedVersion: publishedShift.version,
          employmentId: active.id,
          businessDate: day("2030-01-08"),
          startTime: "11:00",
          endTime: "19:00",
          expectedBreakMinutes: 30,
        }),
      /razón/i,
    );
    const revised = await createOrUpdateShift(actor, {
      periodId: periodA.id,
      shiftId: assigned.id,
      expectedVersion: publishedShift.version,
      employmentId: active.id,
      businessDate: day("2030-01-08"),
      startTime: "11:00",
      endTime: "19:00",
      expectedBreakMinutes: 30,
      reason: "WFQA manager change",
    });
    const revisions = await prisma.shiftRevision.count({
      where: { shiftId: assigned.id },
    });
    assert.equal(revisions, 2);
    const cancelled = await deleteOrCancelShift(actor, {
      shiftId: assigned.id,
      expectedVersion: revised.version,
      reason: "WFQA cancellation",
    });
    assert.equal(cancelled.cancelled, true);
    assert.equal(
      await prisma.shiftRevision.count({ where: { shiftId: assigned.id } }),
      3,
    );
    const source = await createOrUpdateShift(actor, {
      periodId: periodB.id,
      employmentId: null,
      businessDate: day("2030-01-11"),
      startTime: "18:00",
      endTime: "01:00",
      expectedBreakMinutes: 30,
    });
    assert.ok(source.endAt > source.startAt);
    await prisma.shift.create({
      data: {
        schedulePeriodId: periodB.id,
        employmentId: inactive.id,
        branchId: periodB.branchId,
        businessDate: day("2030-01-12"),
        startAt: new Date("2030-01-12T15:00:00.000Z"),
        endAt: new Date("2030-01-12T23:00:00.000Z"),
        expectedBreakMinutes: 0,
        status: "DRAFT",
        createdById: actor.id,
      },
    });
    const target = await ensureSchedulePeriod(
      actor,
      branches[1].id,
      day("2030-01-14"),
    );
    const copied = await copyPreviousScheduleWeek(actor, target.id);
    assert.equal(copied.copied, 1);
    assert.equal(copied.skipped, 1);
    const copiedAgain = await copyPreviousScheduleWeek(actor, target.id);
    assert.equal(copiedAgain.idempotent, true);
    const snapshots = await prisma.schedulePublicationShift.count({
      where: { publicationId: publication.id },
    });
    assert.equal(snapshots, expectedSnapshots);
    console.log(
      JSON.stringify({
        environment: "verified DEV",
        draftCrud: true,
        unassigned: true,
        inactiveBlocked: true,
        unauthorizedBranchBlocked: true,
        sameAndCrossBranchOverlapBlocked: true,
        coverage: true,
        staleVersion: true,
        publishAtomic: true,
        publicationSnapshots: snapshots,
        doublePublishIdempotent: true,
        postPublishRevision: true,
        cancellationHistory: true,
        copyWeek: true,
        copyWeekInvalidEmploymentSkipped: true,
        overnight: true,
      }),
    );
  } finally {
    await cleanup(branches.map((item) => item.id));
    await prisma.$disconnect();
  }
}
main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
