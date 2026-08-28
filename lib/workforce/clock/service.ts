import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reconcileAttendanceForEmployment } from "@/lib/workforce/attendance/reconcile";
import { signalTimesheetsForEmployment } from "@/lib/workforce/timesheet/service";
import { resolveWorkforcePolicy } from "@/lib/workforce/settings/service";
import { buildEffectiveClockStream, type ClockType } from "./effectiveStream";
import {
  clockState,
  reconstructWorkSessions,
  type ClockState,
} from "./reconstruction";

export type ClockActor = { id: string; role: string };
const sourceValues = new Set(["PERSONAL", "KIOSK"]);
function civilDate(value: Date, timezone: string) {
  const text = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return new Date(`${text}T00:00:00.000Z`);
}
async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new Error("CONCURRENT_CLOCK_CONFLICT");
}
async function lockEmployment(
  tx: Prisma.TransactionClient,
  employmentId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${employmentId}))::text AS locked`;
}

export async function resolveOwnActiveEmployment(actor: ClockActor) {
  const employee = await prisma.employee.findUnique({
    where: { userId: actor.id },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        include: {
          employee: true,
          branchAssignments: { include: { branch: true } },
        },
      },
    },
  });
  if (!employee) throw new Error("No existe Employee vinculado.");
  if (employee.employments.length !== 1)
    throw new Error(
      employee.employments.length
        ? "Employment activo ambiguo."
        : "No existe Employment activo.",
    );
  return employee.employments[0];
}
async function authorizedBranch(
  tx: Prisma.TransactionClient,
  employmentId: string,
  branchId: string,
  at: Date,
) {
  const assignment = await tx.branchAssignment.findFirst({
    where: {
      employmentId,
      branchId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
  });
  if (assignment) return true;
  const policy = await resolveWorkforcePolicy(at, tx);
  const proximity = policy.shiftLinkProximityMinutes * 60_000;
  const shift = await tx.shift.findFirst({
    where: {
      employmentId,
      branchId,
      status: "PUBLISHED",
      startAt: { lte: new Date(at.getTime() + proximity) },
      endAt: { gte: new Date(at.getTime() - proximity) },
    },
  });
  return Boolean(shift);
}
async function effectiveFor(
  tx: Prisma.TransactionClient,
  employmentId: string,
) {
  const [events, corrections] = await Promise.all([
    tx.clockEvent.findMany({
      where: { employmentId },
      orderBy: [{ deviceOccurredAt: "asc" }, { id: "asc" }],
    }),
    tx.clockCorrection.findMany({
      where: { employmentId },
      orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return buildEffectiveClockStream(
    events.map((e) => ({
      id: e.id,
      employmentId: e.employmentId,
      branchId: e.branchId,
      type: e.type,
      occurredAt: e.deviceOccurredAt,
    })),
    corrections.map((c) => ({
      id: c.id,
      employmentId: c.employmentId,
      requestedAt: c.requestedAt,
      status: c.status,
      type: c.type,
      targetClockEventId: c.targetClockEventId,
      targetCorrectionId: c.targetCorrectionId,
      branchId: c.branchId,
      proposedEventType: c.proposedEventType,
      proposedOccurredAt: c.proposedOccurredAt,
    })),
  );
}
async function matchingShift(
  tx: Prisma.TransactionClient,
  employmentId: string,
  branchId: string,
  startedAt: Date,
) {
  const policy = await resolveWorkforcePolicy(startedAt, tx);
  const proximity = policy.shiftLinkProximityMinutes * 60_000;
  const candidates = await tx.shift.findMany({
    where: {
      employmentId,
      branchId,
      status: "PUBLISHED",
      startAt: {
        gte: new Date(startedAt.getTime() - proximity),
        lte: new Date(startedAt.getTime() + proximity),
      },
    },
    include: { branch: true },
  });
  return (
    candidates.sort(
      (a, b) =>
        Math.abs(a.startAt.getTime() - startedAt.getTime()) -
          Math.abs(b.startAt.getTime() - startedAt.getTime()) ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}
async function materialize(tx: Prisma.TransactionClient, employmentId: string) {
  const stream = await effectiveFor(tx, employmentId);
  const sessions = reconstructWorkSessions(stream);
  const desiredIds = new Set(sessions.map((session) => `native_${session.key}`));
  const staleSessions = await tx.workSession.findMany({
    where: {
      employmentId,
      origin: "NATIVE_RECONSTRUCTED",
      id: { notIn: [...desiredIds] },
    },
    include: {
      attendanceExceptions: { select: { id: true }, take: 1 },
      timesheetLineLinks: { select: { timesheetLineId: true }, take: 1 },
    },
  });
  for (const stale of staleSessions) {
    if (stale.attendanceExceptions.length || stale.timesheetLineLinks.length)
      throw new Error(
        "No se puede retirar una sesión con vínculos downstream.",
      );
    await tx.workSessionClockEvent.deleteMany({
      where: { workSessionId: stale.id },
    });
    await tx.workSession.delete({ where: { id: stale.id } });
  }
  for (const session of sessions) {
    const shift = session.startedAt
      ? await matchingShift(
          tx,
          employmentId,
          session.branchId,
          session.startedAt,
        )
      : null;
    const branch =
      shift?.branch ??
      (await tx.branch.findUniqueOrThrow({ where: { id: session.branchId } }));
    const eventDate = session.startedAt ?? session.events[0].occurredAt;
    const workforcePolicy = await resolveWorkforcePolicy(eventDate, tx);
    const timezone = branch.timezone ?? workforcePolicy.companyTimezone;
    const id = `native_${session.key}`;
    const existing = await tx.workSession.findUnique({ where: { id } });
    await tx.workSession.upsert({
      where: { id },
      update: {
        branchId: session.branchId,
        shiftId: shift?.id ?? null,
        businessDate:
          shift?.businessDate ??
          civilDate(
            eventDate,
            timezone,
          ),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        workedMinutes: session.workedMinutes,
        breakMinutes: session.breakMinutes,
        status: session.status,
        reconstructionVersion: { increment: 1 },
        reconstructedAt: new Date(),
      },
      create: {
        id,
        employmentId,
        branchId: session.branchId,
        shiftId: shift?.id ?? null,
        businessDate:
          shift?.businessDate ??
          civilDate(
            eventDate,
            timezone,
          ),
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        workedMinutes: session.workedMinutes,
        breakMinutes: session.breakMinutes,
        status: session.status,
        origin: "NATIVE_RECONSTRUCTED",
        reconstructionVersion: 1,
        reconstructedAt: new Date(),
      },
    });
    await tx.workSessionClockEvent.deleteMany({ where: { workSessionId: id } });
    const observed = session.events
      .filter((e) => e.originalClockEventId)
      .map((e, index) => ({
        workSessionId: id,
        clockEventId: e.originalClockEventId!,
        sequence: index,
      }));
    if (observed.length)
      await tx.workSessionClockEvent.createMany({ data: observed });
    if (existing?.origin === "LEGACY_IMPORTED")
      throw new Error("No se reconstruye una sesión legacy.");
  }
  await reconcileAttendanceForEmployment(tx, employmentId);
  await signalTimesheetsForEmployment(tx, employmentId);
  return { stream, sessions };
}

export async function getClockDashboard(actor: ClockActor) {
  const employment = await resolveOwnActiveEmployment(actor);
  const now = new Date();
  const [branches, shifts] = await Promise.all([
    prisma.branchAssignment.findMany({
      where: {
        employmentId: employment.id,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      include: { branch: true },
    }),
    prisma.shift.findMany({
      where: {
        employmentId: employment.id,
        status: "PUBLISHED",
        startAt: { lte: new Date(now.getTime() + 18 * 3600000) },
        endAt: { gte: new Date(now.getTime() - 18 * 3600000) },
      },
      include: { branch: true },
      orderBy: { startAt: "asc" },
    }),
  ]);
  const stream = await prisma.$transaction((tx) =>
    effectiveFor(tx, employment.id),
  );
  let state: ClockState = "NO_SESSION";
  try {
    state = clockState(
      stream.slice(stream.map((e) => e.type).lastIndexOf("CLOCK_OUT") + 1),
    );
  } catch {
    state = "NO_SESSION";
  }
  return {
    employment,
    branches: branches.map((a) => a.branch),
    shifts,
    state,
    lastEvent: stream.at(-1) ?? null,
  };
}

export async function recordClockEvent(
  actor: ClockActor,
  input: {
    employmentId: string;
    branchId: string;
    type: ClockType;
    source: string;
    idempotencyKey: string;
  },
) {
  if (!sourceValues.has(input.source)) throw new Error("Fuente inválida.");
  if (!input.idempotencyKey || input.idempotencyKey.length > 100)
    throw new Error("Idempotency key inválida.");
  if (actor.role !== "ADMIN") {
    const own = await resolveOwnActiveEmployment(actor);
    if (own.id !== input.employmentId)
      throw new Error("No autorizado para otro Employee.");
  }
  return serializable(async (tx) => {
    await lockEmployment(tx, input.employmentId);
    const duplicate = await tx.clockEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (duplicate) {
      if (
        duplicate.employmentId !== input.employmentId ||
        duplicate.type !== input.type
      )
        throw new Error("Idempotency key reutilizada con otra operación.");
      return { event: duplicate, idempotent: true };
    }
    const now = new Date();
    const employment = await tx.employment.findUnique({
      where: { id: input.employmentId },
    });
    if (!employment || employment.status !== "ACTIVE")
      throw new Error("Employment no activo.");
    if (!(await authorizedBranch(tx, input.employmentId, input.branchId, now)))
      throw new Error("Sucursal no autorizada.");
    const policy = await resolveWorkforcePolicy(now, tx);
    if (
      input.type === "CLOCK_IN" &&
      !policy.allowUnscheduledWork &&
      !(await matchingShift(tx, input.employmentId, input.branchId, now))
    )
      throw new Error("El trabajo no programado está deshabilitado por política.");
    const stream = await effectiveFor(tx, input.employmentId);
    const open = stream.slice(
      stream.map((e) => e.type).lastIndexOf("CLOCK_OUT") + 1,
    );
    const state = clockState(open);
    if (!(
      (state === "NO_SESSION" && input.type === "CLOCK_IN") ||
      (state === "CLOCKED_IN" &&
        (input.type === "BREAK_START" || input.type === "CLOCK_OUT")) ||
      (state === "ON_BREAK" && input.type === "BREAK_END")
    ))
      throw new Error(`INVALID_TRANSITION: ${state} → ${input.type}`);
    const branch = await tx.branch.findUniqueOrThrow({
      where: { id: input.branchId },
    });
    const event = await tx.clockEvent.create({
      data: {
        employmentId: input.employmentId,
        branchId: input.branchId,
        type: input.type,
        deviceOccurredAt: now,
        serverReceivedAt: now,
        timezone: branch.timezone ?? policy.companyTimezone,
        source: input.source,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await materialize(tx, input.employmentId);
    return { event, idempotent: false };
  });
}

export async function requestCorrection(
  actor: ClockActor,
  input: {
    type: "MODIFY_OCCURRED_TIME" | "ADD_MISSING_EVENT" | "VOID_EVENT";
    targetClockEventId?: string | null;
    targetCorrectionId?: string | null;
    branchId?: string | null;
    proposedEventType?: ClockType | null;
    proposedOccurredAt?: Date | null;
    reason: string;
  },
) {
  const employment = await resolveOwnActiveEmployment(actor);
  if (input.reason.trim().length < 5) throw new Error("Razón demasiado corta.");
  const targets = Number(Boolean(input.targetClockEventId)) +
    Number(Boolean(input.targetCorrectionId));
  if (input.type === "ADD_MISSING_EVENT") {
    if (
      targets ||
      !input.branchId ||
      !input.proposedEventType ||
      !input.proposedOccurredAt
    )
      throw new Error("ADD_MISSING_EVENT requiere tipo, hora y sucursal.");
  } else if (targets !== 1) {
    throw new Error("La corrección requiere exactamente un objetivo.");
  }
  if (
    input.type === "MODIFY_OCCURRED_TIME" &&
    !input.proposedOccurredAt
  )
    throw new Error("MODIFY_OCCURRED_TIME requiere hora propuesta.");
  if (input.type === "VOID_EVENT" && input.proposedOccurredAt)
    throw new Error("VOID_EVENT no acepta hora propuesta.");
  if (input.proposedOccurredAt) {
    const delta = input.proposedOccurredAt.getTime() - Date.now();
    if (delta > 5 * 60000 || delta < -31 * 86400000)
      throw new Error("Hora propuesta fuera de la ventana permitida.");
  }
  if (input.targetClockEventId) {
    const target = await prisma.clockEvent.findFirst({
      where: {
        id: input.targetClockEventId,
        employmentId: employment.id,
      },
      select: { id: true },
    });
    if (!target) throw new Error("Evento objetivo no autorizado o inexistente.");
  }
  if (input.targetCorrectionId) {
    const target = await prisma.clockCorrection.findFirst({
      where: {
        id: input.targetCorrectionId,
        employmentId: employment.id,
        status: "APPROVED",
        type: "ADD_MISSING_EVENT",
      },
      select: { id: true },
    });
    if (!target)
      throw new Error("Corrección objetivo no autorizada o no compensable.");
  }
  if (
    input.branchId &&
    !(await prisma.branchAssignment.findFirst({
      where: { employmentId: employment.id, branchId: input.branchId },
    }))
  )
    throw new Error("Sucursal no autorizada.");
  return prisma.clockCorrection.create({
    data: {
      employmentId: employment.id,
      branchId: input.branchId ?? null,
      targetClockEventId: input.targetClockEventId ?? null,
      targetCorrectionId: input.targetCorrectionId ?? null,
      type: input.type,
      proposedEventType: input.proposedEventType ?? null,
      proposedOccurredAt: input.proposedOccurredAt ?? null,
      reason: input.reason.trim(),
      requestedById: actor.id,
    },
  });
}
export async function decideCorrection(
  actor: ClockActor,
  input: {
    correctionId: string;
    decision: "APPROVED" | "REJECTED";
    rejectionReason?: string;
  },
) {
  if (actor.role !== "ADMIN")
    throw new Error("No autorizado.");
  return serializable(async (tx) => {
    const correction = await tx.clockCorrection.findUnique({
      where: { id: input.correctionId },
    });
    if (!correction || correction.status !== "PENDING")
      throw new Error("La corrección ya es final o no existe.");
    await lockEmployment(tx, correction.employmentId);
    const updated = await tx.clockCorrection.update({
      where: { id: correction.id },
      data:
        input.decision === "APPROVED"
          ? {
              status: "APPROVED",
              approvedById: actor.id,
              approvedAt: new Date(),
            }
          : {
              status: "REJECTED",
              rejectedById: actor.id,
              rejectedAt: new Date(),
              rejectionReason:
                input.rejectionReason?.trim() || "Rechazada por manager",
            },
    });
    if (input.decision === "APPROVED")
      await materialize(tx, correction.employmentId);
    return updated;
  });
}
export async function listPendingCorrections() {
  return prisma.clockCorrection.findMany({
    where: { status: "PENDING" },
    include: {
      employment: { include: { employee: true } },
      branch: true,
      targetClockEvent: true,
      requestedBy: { select: { name: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
}
