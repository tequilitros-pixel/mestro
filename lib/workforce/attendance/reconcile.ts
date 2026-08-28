import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ATTENDANCE_POLICY, type AttendancePolicy } from "./policy";
import { evaluateAttendance } from "./evaluate";

type DbClient = Prisma.TransactionClient;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function reconcileWithClient(
  tx: DbClient,
  input: {
    start: Date;
    end: Date;
    now: Date;
    policy: AttendancePolicy;
    employmentId?: string;
    branchIds?: string[];
  },
) {
  const branchWhere = input.branchIds
    ? { branchId: { in: input.branchIds } }
    : {};
  const employmentWhere = input.employmentId
    ? { employmentId: input.employmentId }
    : {};
  const [shifts, sessions] = await Promise.all([
    tx.shift.findMany({
      where: {
        businessDate: { gte: input.start, lte: input.end },
        ...employmentWhere,
        ...branchWhere,
        status: { in: ["PUBLISHED", "CANCELLED"] },
      },
    }),
    tx.workSession.findMany({
      where: {
        businessDate: { gte: input.start, lte: input.end },
        ...employmentWhere,
        ...branchWhere,
      },
    }),
  ]);
  const evaluation = evaluateAttendance({
    shifts,
    sessions,
    policy: input.policy,
    now: input.now,
  });
  const fingerprints = new Set<string>();
  for (const item of evaluation.expected) {
    const fingerprint = hash(item.evidenceKey);
    fingerprints.add(fingerprint);
    await tx.attendanceException.upsert({
      where: { fingerprint },
      update: { evaluatedAt: input.now },
      create: {
        employmentId: item.employmentId,
        branchId: item.branchId,
        businessDate: item.businessDate,
        shiftId: item.shiftId,
        workSessionId: item.workSessionId,
        type: item.type,
        severity: item.severity,
        blocking: item.severity === "CRITICAL",
        derivationKey: item.derivationKey,
        fingerprint,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        actualStart: item.actualStart,
        actualEnd: item.actualEnd,
        differenceMinutes: item.differenceMinutes,
        policySnapshot: item.policySnapshot,
        evaluatedAt: input.now,
      },
    });
  }
  const stale = await tx.attendanceException.findMany({
    where: {
      status: "OPEN",
      derivationVersion: 1,
      businessDate: { gte: input.start, lte: input.end },
      ...employmentWhere,
      ...branchWhere,
      ...(fingerprints.size
        ? { fingerprint: { notIn: [...fingerprints] } }
        : {}),
    },
    select: { id: true },
  });
  if (stale.length)
    await tx.attendanceException.updateMany({
      where: { id: { in: stale.map((item) => item.id) }, status: "OPEN" },
      data: {
        status: "RESOLVED",
        resolvedAt: input.now,
        resolution:
          "Auto-resuelta: los hechos efectivos ya no cumplen la condición.",
      },
    });
  return {
    expectedCount: evaluation.expected.length,
    autoResolvedCount: stale.length,
  };
}

export async function reconcileAttendanceForEmployment(
  tx: DbClient,
  employmentId: string,
  now = new Date(),
) {
  return reconcileWithClient(tx, {
    employmentId,
    start: new Date(now.getTime() - 31 * 86_400_000),
    end: new Date(now.getTime() + 2 * 86_400_000),
    now,
    policy: DEFAULT_ATTENDANCE_POLICY,
  });
}

export async function reconcileAttendanceScope(input: {
  start: Date;
  end: Date;
  now?: Date;
  policy?: AttendancePolicy;
  branchIds?: string[];
  employmentId?: string;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        (tx) =>
          reconcileWithClient(tx, {
            ...input,
            now: input.now ?? new Date(),
            policy: input.policy ?? DEFAULT_ATTENDANCE_POLICY,
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code) &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new Error("No se pudo reconciliar asistencia por concurrencia.");
}
