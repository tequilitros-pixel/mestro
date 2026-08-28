import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reconcileAttendanceForEmployment } from "@/lib/workforce/attendance/reconcile";
import {
  dateOnly,
  effectiveAvailability,
} from "@/lib/workforce/availability/rules";
import {
  assertSchedulingBranchAccess,
  availabilityWarning,
  calculateCoverage,
  dateKey,
  overtimeRisk,
  scheduledHours,
  shiftInstants,
  validateShiftFacts,
  weekEnd,
  type ShiftWindow,
} from "./rules";

export type SchedulingActor = {
  id: string;
  role: string;
  accessibleBranchIds: string[] | null;
};
export type ShiftCommand = {
  periodId: string;
  shiftId?: string;
  expectedVersion?: number;
  employmentId: string | null;
  businessDate: Date;
  startTime: string;
  endTime: string;
  expectedBreakMinutes: number;
  reason?: string | null;
};

function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 10_000,
  });
}
function ensureReason(reason: string | null | undefined) {
  const value = reason?.trim();
  if (!value)
    throw new Error("La razón del cambio es obligatoria después de publicar.");
  return value;
}

async function thresholdForBranch(branchId: string) {
  const [specific, global] = await Promise.all([
    prisma.payrollSettings.findUnique({ where: { branchId } }),
    prisma.payrollSettings.findUnique({ where: { id: "default" } }),
  ]);
  return Number(
    specific?.weeklyHourThreshold ?? global?.weeklyHourThreshold ?? 48,
  );
}

async function validateAssignedShift(
  tx: Prisma.TransactionClient,
  input: {
    employmentId: string;
    branchId: string;
    businessDate: Date;
    startAt: Date;
    endAt: Date;
    periodStart: Date;
    periodEnd: Date;
    excludeShiftId?: string;
  },
) {
  const employment = await tx.employment.findUnique({
    where: { id: input.employmentId },
    include: { branchAssignments: true },
  });
  const branchAuthorized = Boolean(
    employment?.branchAssignments.some(
      (item) =>
        item.branchId === input.branchId &&
        item.effectiveFrom <= input.startAt &&
        (!item.effectiveTo || item.effectiveTo >= input.endAt),
    ),
  );
  const baseFacts = validateShiftFacts({
    shift: {
      employmentId: input.employmentId,
      branchId: input.branchId,
      businessDate: input.businessDate,
      startAt: input.startAt,
      endAt: input.endAt,
    },
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    employmentStatus: employment?.status,
    branchAuthorized,
    overlaps: false,
  });
  if (baseFacts.blockers.length)
    throw new Error(`Bloqueado: ${baseFacts.blockers.join(", ")}`);
  const overlap = await tx.shift.findFirst({
    where: {
      employmentId: input.employmentId,
      status: { not: "CANCELLED" },
      id: input.excludeShiftId ? { not: input.excludeShiftId } : undefined,
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
  });
  if (overlap) throw new Error("Bloqueado: OVERLAPPING_SHIFT");
  return employment!;
}

export async function listSchedulingBranches(actor: SchedulingActor) {
  const where =
    actor.role === "ADMIN"
      ? { active: true }
      : { active: true, id: { in: actor.accessibleBranchIds ?? [] } };
  return prisma.branch.findMany({ where, orderBy: { name: "asc" } });
}

export async function getScheduleBoard(
  actor: SchedulingActor,
  branchId: string,
  weekStartInput: Date,
) {
  assertSchedulingBranchAccess(actor.role, actor.accessibleBranchIds, branchId);
  const start = dateOnly(weekStartInput),
    end = weekEnd(start);
  const [branch, period, employments, requirements, threshold] =
    await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId } }),
      prisma.schedulePeriod.findUnique({
        where: {
          branchId_periodStart_periodEnd: {
            branchId,
            periodStart: start,
            periodEnd: end,
          },
        },
        include: {
          publications: { orderBy: { version: "desc" } },
          shifts: {
            include: {
              employment: {
                include: {
                  employee: true,
                  availabilityRules: true,
                  availabilityExceptions: {
                    where: { date: { gte: start, lte: end } },
                  },
                },
              },
              revisions: {
                include: { changedBy: { select: { name: true } } },
                orderBy: { revisionNumber: "desc" },
              },
            },
            orderBy: [{ businessDate: "asc" }, { startAt: "asc" }],
          },
        },
      }),
      prisma.employment.findMany({
        where: {
          status: "ACTIVE",
          branchAssignments: {
            some: {
              branchId,
              effectiveFrom: { lte: end },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
            },
          },
        },
        include: {
          employee: true,
          availabilityRules: true,
          availabilityExceptions: { where: { date: { gte: start, lte: end } } },
          branchAssignments: true,
        },
        orderBy: { employee: { displayName: "asc" } },
      }),
      prisma.staffingRequirement.findMany({
        where: { branchId, businessDate: { gte: start, lte: end } },
        orderBy: [{ businessDate: "asc" }, { startTime: "asc" }],
      }),
      thresholdForBranch(branchId),
    ]);
  if (!branch) throw new Error("Sucursal no encontrada.");
  const timezone = branch.timezone ?? "America/Mexico_City";
  const shifts = period?.shifts ?? [];
  const hours = scheduledHours(shifts);
  const availability = new Map<
    string,
    ReturnType<typeof effectiveAvailability>
  >();
  for (const employment of employments)
    for (let i = 0; i < 7; i++) {
      const day = new Date(start.getTime() + i * 86_400_000);
      const exception = employment.availabilityExceptions.find(
        (item) => dateKey(item.date) === dateKey(day),
      );
      availability.set(
        `${employment.id}|${dateKey(day)}`,
        effectiveAvailability({
          date: day,
          rules: employment.availabilityRules,
          exception,
        }),
      );
    }
  const coverage = requirements.map((item) => {
    const window = shiftInstants({
      businessDate: item.businessDate,
      startTime: item.startTime,
      endTime: item.endTime,
      timezone,
    });
    return {
      ...item,
      ...calculateCoverage(
        { ...window, requiredCount: item.requiredCount },
        shifts as ShiftWindow[],
      ),
    };
  });
  const shiftWarnings = new Map<string, string[]>();
  for (const shift of shifts) {
    const list: string[] = [];
    if (!shift.employmentId) list.push("UNASSIGNED");
    else {
      const value = availability.get(
        `${shift.employmentId}|${dateKey(shift.businessDate)}`,
      );
      if (value) {
        const warning = availabilityWarning(value);
        if (warning) list.push(warning);
      }
      if (overtimeRisk(hours.get(shift.employmentId) ?? 0, threshold).risk)
        list.push("OVERTIME_RISK");
    }
    shiftWarnings.set(shift.id, list);
  }
  return {
    branch,
    timezone,
    start,
    end,
    period,
    employments,
    requirements,
    coverage,
    hours,
    threshold,
    availability,
    shiftWarnings,
  };
}

export async function createOrUpdateShift(
  actor: SchedulingActor,
  input: ShiftCommand,
) {
  return serializable(async (tx) => {
    const period = await tx.schedulePeriod.findUnique({
      where: { id: input.periodId },
      include: { branch: true, publications: { select: { id: true } } },
    });
    if (!period) throw new Error("Semana no encontrada.");
    assertSchedulingBranchAccess(
      actor.role,
      actor.accessibleBranchIds,
      period.branchId,
    );
    const timezone = period.branch.timezone ?? "America/Mexico_City";
    const businessDate = dateOnly(input.businessDate);
    const { startAt, endAt } = shiftInstants({
      businessDate,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone,
    });
    if (input.employmentId)
      await validateAssignedShift(tx, {
        employmentId: input.employmentId,
        branchId: period.branchId,
        businessDate,
        startAt,
        endAt,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        excludeShiftId: input.shiftId,
      });
    else {
      const facts = validateShiftFacts({
        shift: {
          employmentId: null,
          branchId: period.branchId,
          businessDate,
          startAt,
          endAt,
        },
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });
      if (facts.blockers.length)
        throw new Error(`Bloqueado: ${facts.blockers.join(", ")}`);
    }
    const published =
      period.publications.length > 0 || period.status === "PUBLISHED";
    if (!input.shiftId) {
      const reason = published ? ensureReason(input.reason) : null;
      const shift = await tx.shift.create({
        data: {
          schedulePeriodId: period.id,
          employmentId: input.employmentId,
          branchId: period.branchId,
          businessDate,
          startAt,
          endAt,
          expectedBreakMinutes: input.expectedBreakMinutes,
          status: published ? "PUBLISHED" : "DRAFT",
          createdById: actor.id,
        },
      });
      if (published)
        await tx.shiftRevision.create({
          data: {
            shiftId: shift.id,
            revisionNumber: 1,
            employmentId: input.employmentId,
            branchId: period.branchId,
            businessDate,
            startAt,
            endAt,
            expectedBreakMinutes: input.expectedBreakMinutes,
            status: "PUBLISHED",
            reason: reason!,
            changedById: actor.id,
          },
        });
      if (published && input.employmentId)
        await reconcileAttendanceForEmployment(tx, input.employmentId);
      return shift;
    }
    const current = await tx.shift.findUnique({
      where: { id: input.shiftId },
      include: {
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
        publicationLinks: { select: { id: true } },
      },
    });
    if (!current || current.schedulePeriodId !== period.id)
      throw new Error("Turno no encontrado.");
    if (current.version !== input.expectedVersion)
      throw new Error(
        "STALE_VERSION: el turno cambió; recarga antes de guardar.",
      );
    const result = await tx.shift.updateMany({
      where: { id: current.id, version: input.expectedVersion },
      data: {
        employmentId: input.employmentId,
        businessDate,
        startAt,
        endAt,
        expectedBreakMinutes: input.expectedBreakMinutes,
        version: { increment: 1 },
        status: published ? "PUBLISHED" : "DRAFT",
      },
    });
    if (result.count !== 1)
      throw new Error(
        "STALE_VERSION: el turno cambió; recarga antes de guardar.",
      );
    if (published || current.publicationLinks.length) {
      const reason = ensureReason(input.reason);
      await tx.shiftRevision.create({
        data: {
          shiftId: current.id,
          revisionNumber: (current.revisions[0]?.revisionNumber ?? 0) + 1,
          employmentId: input.employmentId,
          branchId: period.branchId,
          businessDate,
          startAt,
          endAt,
          expectedBreakMinutes: input.expectedBreakMinutes,
          status: "PUBLISHED",
          reason,
          changedById: actor.id,
        },
      });
      const employmentIds = new Set(
        [current.employmentId, input.employmentId].filter(
          (id): id is string => Boolean(id),
        ),
      );
      for (const employmentId of employmentIds)
        await reconcileAttendanceForEmployment(tx, employmentId);
    }
    return tx.shift.findUniqueOrThrow({ where: { id: current.id } });
  }).catch((error) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw new Error("Conflicto concurrente; vuelve a intentar.");
    throw error;
  });
}

export async function deleteOrCancelShift(
  actor: SchedulingActor,
  input: { shiftId: string; expectedVersion: number; reason?: string | null },
) {
  return serializable(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: input.shiftId },
      include: {
        schedulePeriod: true,
        publicationLinks: true,
        revisions: { orderBy: { revisionNumber: "desc" }, take: 1 },
      },
    });
    if (!shift) throw new Error("Turno no encontrado.");
    assertSchedulingBranchAccess(
      actor.role,
      actor.accessibleBranchIds,
      shift.branchId,
    );
    if (shift.version !== input.expectedVersion)
      throw new Error(
        "STALE_VERSION: el turno cambió; recarga antes de guardar.",
      );
    if (
      !shift.publicationLinks.length &&
      shift.schedulePeriod.status === "DRAFT"
    ) {
      await tx.shift.delete({ where: { id: shift.id } });
      return { deleted: true, cancelled: false };
    }
    const reason = ensureReason(input.reason);
    const updated = await tx.shift.updateMany({
      where: { id: shift.id, version: input.expectedVersion },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new Error(
        "STALE_VERSION: el turno cambió; recarga antes de guardar.",
      );
    await tx.shiftRevision.create({
      data: {
        shiftId: shift.id,
        revisionNumber: (shift.revisions[0]?.revisionNumber ?? 0) + 1,
        employmentId: shift.employmentId,
        branchId: shift.branchId,
        businessDate: shift.businessDate,
        startAt: shift.startAt,
        endAt: shift.endAt,
        expectedBreakMinutes: shift.expectedBreakMinutes,
        status: "CANCELLED",
        reason,
        changedById: actor.id,
      },
    });
    if (shift.employmentId)
      await reconcileAttendanceForEmployment(tx, shift.employmentId);
    return { deleted: false, cancelled: true };
  });
}

export async function publishSchedulePeriod(
  actor: SchedulingActor,
  periodId: string,
) {
  return serializable(async (tx) => {
    const period = await tx.schedulePeriod.findUnique({
      where: { id: periodId },
      include: {
        shifts: true,
        publications: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!period) throw new Error("Semana no encontrada.");
    assertSchedulingBranchAccess(
      actor.role,
      actor.accessibleBranchIds,
      period.branchId,
    );
    if (period.status === "PUBLISHED" && period.publications[0])
      return { id: period.publications[0].id, idempotent: true };
    const blockers: string[] = [];
    for (const shift of period.shifts)
      if (shift.employmentId)
        try {
          await validateAssignedShift(tx, {
            employmentId: shift.employmentId,
            branchId: period.branchId,
            businessDate: shift.businessDate,
            startAt: shift.startAt,
            endAt: shift.endAt,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            excludeShiftId: shift.id,
          });
        } catch (error) {
          blockers.push(
            `${shift.id}: ${error instanceof Error ? error.message : "inválido"}`,
          );
        }
    if (blockers.length)
      throw new Error(`Publicación bloqueada: ${blockers.join("; ")}`);
    const version = (period.publications[0]?.version ?? 0) + 1;
    const publication = await tx.schedulePublication.create({
      data: { schedulePeriodId: period.id, version, publishedById: actor.id },
    });
    for (const shift of period.shifts) {
      const latest = await tx.shiftRevision.findFirst({
        where: { shiftId: shift.id },
        orderBy: { revisionNumber: "desc" },
      });
      const revision = await tx.shiftRevision.create({
        data: {
          shiftId: shift.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          employmentId: shift.employmentId,
          branchId: shift.branchId,
          businessDate: shift.businessDate,
          startAt: shift.startAt,
          endAt: shift.endAt,
          expectedBreakMinutes: shift.expectedBreakMinutes,
          status: shift.status === "CANCELLED" ? "CANCELLED" : "PUBLISHED",
          reason: "Publicación inicial de semana",
          changedById: actor.id,
        },
      });
      await tx.schedulePublicationShift.create({
        data: {
          publicationId: publication.id,
          shiftId: shift.id,
          shiftRevisionId: revision.id,
        },
      });
    }
    await tx.shift.updateMany({
      where: { schedulePeriodId: period.id, status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });
    await tx.schedulePeriod.update({
      where: { id: period.id },
      data: { status: "PUBLISHED", version: { increment: 1 } },
    });
    for (const employmentId of new Set(
      period.shifts
        .map((shift) => shift.employmentId)
        .filter((id): id is string => Boolean(id)),
    ))
      await reconcileAttendanceForEmployment(tx, employmentId);
    return { id: publication.id, idempotent: false };
  }).catch((error) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    )
      throw new Error(
        "La semana ya se publicó o cambió concurrentemente; recarga.",
      );
    throw error;
  });
}

export async function ensureSchedulePeriod(
  actor: SchedulingActor,
  branchId: string,
  weekStartInput: Date,
) {
  assertSchedulingBranchAccess(actor.role, actor.accessibleBranchIds, branchId);
  const periodStart = dateOnly(weekStartInput),
    periodEnd = weekEnd(periodStart);
  return prisma.schedulePeriod.upsert({
    where: {
      branchId_periodStart_periodEnd: { branchId, periodStart, periodEnd },
    },
    update: {},
    create: { branchId, periodStart, periodEnd, createdById: actor.id },
  });
}

export async function copyPreviousScheduleWeek(
  actor: SchedulingActor,
  targetPeriodId: string,
) {
  return serializable(async (tx) => {
    const target = await tx.schedulePeriod.findUnique({
      where: { id: targetPeriodId },
      include: { shifts: true, branch: true },
    });
    if (!target) throw new Error("Semana destino no encontrada.");
    assertSchedulingBranchAccess(
      actor.role,
      actor.accessibleBranchIds,
      target.branchId,
    );
    if (target.status !== "DRAFT")
      throw new Error("Copy Week sólo crea borradores.");
    if (target.shifts.length)
      return { copied: target.shifts.length, skipped: 0, idempotent: true };
    const sourceStart = new Date(target.periodStart.getTime() - 7 * 86_400_000),
      sourceEnd = new Date(target.periodEnd.getTime() - 7 * 86_400_000);
    const source = await tx.schedulePeriod.findUnique({
      where: {
        branchId_periodStart_periodEnd: {
          branchId: target.branchId,
          periodStart: sourceStart,
          periodEnd: sourceEnd,
        },
      },
      include: { shifts: true },
    });
    if (!source) return { copied: 0, skipped: 0, idempotent: false };
    let copied = 0,
      skipped = 0;
    for (const shift of source.shifts.filter(
      (item) => item.status !== "CANCELLED",
    )) {
      const businessDate = new Date(
          shift.businessDate.getTime() + 7 * 86_400_000,
        ),
        startAt = new Date(shift.startAt.getTime() + 7 * 86_400_000),
        endAt = new Date(shift.endAt.getTime() + 7 * 86_400_000);
      try {
        if (shift.employmentId)
          await validateAssignedShift(tx, {
            employmentId: shift.employmentId,
            branchId: target.branchId,
            businessDate,
            startAt,
            endAt,
            periodStart: target.periodStart,
            periodEnd: target.periodEnd,
          });
        await tx.shift.create({
          data: {
            schedulePeriodId: target.id,
            employmentId: shift.employmentId,
            branchId: target.branchId,
            businessDate,
            startAt,
            endAt,
            expectedBreakMinutes: shift.expectedBreakMinutes,
            status: "DRAFT",
            createdById: actor.id,
          },
        });
        copied++;
      } catch {
        skipped++;
      }
    }
    return { copied, skipped, idempotent: false };
  });
}

export async function upsertStaffingRequirement(
  actor: SchedulingActor,
  input: {
    branchId: string;
    businessDate: Date;
    startTime: string;
    endTime: string;
    requiredCount: number;
  },
) {
  assertSchedulingBranchAccess(
    actor.role,
    actor.accessibleBranchIds,
    input.branchId,
  );
  if (!Number.isInteger(input.requiredCount) || input.requiredCount < 1)
    throw new Error("Required debe ser al menos 1.");
  if (input.startTime === input.endTime)
    throw new Error("La ventana de cobertura es inválida.");
  return prisma.staffingRequirement.upsert({
    where: {
      branchId_businessDate_startTime_endTime: {
        branchId: input.branchId,
        businessDate: dateOnly(input.businessDate),
        startTime: input.startTime,
        endTime: input.endTime,
      },
    },
    update: { requiredCount: input.requiredCount },
    create: {
      branchId: input.branchId,
      businessDate: dateOnly(input.businessDate),
      startTime: input.startTime,
      endTime: input.endTime,
      requiredCount: input.requiredCount,
      createdById: actor.id,
    },
  });
}

export async function getPublicationValidation(
  actor: SchedulingActor,
  branchId: string,
  weekStartInput: Date,
) {
  const board = await getScheduleBoard(actor, branchId, weekStartInput);
  const blockers: string[] = [];
  const warnings: string[] = [];
  await serializable(async (tx) => {
    for (const shift of board.period?.shifts ?? []) {
      if (!shift.employmentId) continue;
      try {
        await validateAssignedShift(tx, {
          employmentId: shift.employmentId,
          branchId: shift.branchId,
          businessDate: shift.businessDate,
          startAt: shift.startAt,
          endAt: shift.endAt,
          periodStart: board.start,
          periodEnd: board.end,
          excludeShiftId: shift.id,
        });
      } catch (error) {
        blockers.push(
          `${shift.id}: ${error instanceof Error ? error.message : "DATA_INTEGRITY"}`,
        );
      }
    }
  });
  for (const shift of board.period?.shifts ?? []) {
    for (const warning of board.shiftWarnings.get(shift.id) ?? [])
      warnings.push(`${shift.id}: ${warning}`);
  }
  for (const item of board.coverage)
    if (item.status === "UNDERSTAFFED")
      warnings.push(`${item.id}: COVERAGE_GAP`);
  return {
    shiftCount: board.period?.shifts.length ?? 0,
    employeeCount: new Set(
      (board.period?.shifts ?? [])
        .map((item) => item.employmentId)
        .filter(Boolean),
    ).size,
    blockers,
    warnings,
  };
}
