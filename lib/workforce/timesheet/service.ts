import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aggregateWeek, dateKey, mondayOf, sundayOf, timesheetReadiness } from "./rules";

type Tx = Prisma.TransactionClient;
export type TimesheetActor = {
  id: string;
  role: string;
  accessibleBranchIds: string[] | null;
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signedMinutes = (type: string, minutes: number) =>
  type === "REMOVE_PAYABLE_TIME" ? -minutes : minutes;
const transaction = <T>(fn: (tx: Tx) => Promise<T>) =>
  prisma.$transaction(fn, { maxWait: 5_000, timeout: 20_000 });

function assertMonday(start: Date) {
  if (start.getUTCDay() !== 1) throw new Error("El periodo debe iniciar en lunes.");
}
async function ensurePayrollPeriod(tx: Tx, periodStart: Date) {
  assertMonday(periodStart);
  const periodEnd = sundayOf(periodStart);
  return tx.payrollPeriod.upsert({
    where: { weekStart: periodStart },
    update: { weekEnd: periodEnd },
    create: { weekStart: periodStart, weekEnd: periodEnd },
  });
}
async function sourceFacts(tx: Tx, employmentId: string, start: Date, end: Date) {
  const sessions = await tx.workSession.findMany({
      where: { employmentId, businessDate: { gte: start, lte: end } },
      orderBy: [{ businessDate: "asc" }, { startedAt: "asc" }, { id: "asc" }],
    });
  const shifts = await tx.shift.findMany({
      where: { employmentId, businessDate: { gte: start, lte: end } },
      orderBy: [{ businessDate: "asc" }, { startAt: "asc" }, { id: "asc" }],
    });
  const issues = await tx.attendanceException.findMany({
      where: { employmentId, businessDate: { gte: start, lte: end } },
      orderBy: [{ businessDate: "asc" }, { type: "asc" }, { id: "asc" }],
    });
  const fingerprint = hash(
    JSON.stringify({
      sessions: sessions.map((item) => [
        item.id,
        item.businessDate,
        item.startedAt,
        item.endedAt,
        item.workedMinutes,
        item.breakMinutes,
        item.status,
        item.reconstructionVersion,
      ]),
      shifts: shifts.map((item) => [
        item.id,
        item.startAt,
        item.endAt,
        item.status,
        item.version,
      ]),
      issues: issues.map((item) => [
        item.id,
        item.type,
        item.status,
        item.resolvedAt,
      ]),
    }),
  );
  return { sessions, shifts, issues, fingerprint };
}

async function ensureTimesheetTx(tx: Tx, employmentId: string, periodStart: Date) {
  const payrollPeriod = await ensurePayrollPeriod(tx, periodStart);
  const employment = await tx.employment.findUnique({ where: { id: employmentId } });
  if (!employment) throw new Error("Employment no encontrado.");
  if (employment.startedAt && employment.startedAt > payrollPeriod.weekEnd)
    throw new Error("Employment aún no iniciado en este periodo.");
  if (employment.endedAt && employment.endedAt < payrollPeriod.weekStart)
    throw new Error("Employment terminado antes de este periodo.");
  return tx.timesheet.upsert({
    where: {
      employmentId_payrollPeriodId: { employmentId, payrollPeriodId: payrollPeriod.id },
    },
    update: {},
    create: {
      employmentId,
      payrollPeriodId: payrollPeriod.id,
      periodStart: payrollPeriod.weekStart,
      periodEnd: payrollPeriod.weekEnd,
      sourceFingerprint: hash("empty"),
    },
  });
}

async function recomputeTx(tx: Tx, timesheetId: string) {
  const timesheet = await tx.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: { lines: { include: { adjustments: true } } },
  });
  const facts = await sourceFacts(
    tx,
    timesheet.employmentId,
    timesheet.periodStart,
    timesheet.periodEnd,
  );
  if (timesheet.status === "APPROVED" || timesheet.status === "LOCKED") {
    if (timesheet.approvedSourceFingerprint !== facts.fingerprint) {
      await tx.timesheet.update({
        where: { id: timesheet.id },
        data: { requiresAdjustment: true, sourceFingerprint: facts.fingerprint },
      });
      await tx.workforceOvertimeCalculation.updateMany({
        where: { timesheetId: timesheet.id, status: "FINAL" },
        data: { status: "STALE" },
      });
    }
    return tx.timesheet.findUniqueOrThrow({ where: { id: timesheet.id } });
  }
  const aggregates = aggregateWeek({
    periodStart: timesheet.periodStart,
    sessions: facts.sessions,
    shifts: facts.shifts,
    issues: facts.issues,
  });
  for (const day of aggregates) {
    const existing = timesheet.lines.find(
      (line) => dateKey(line.businessDate) === dateKey(day.businessDate),
    );
    const adjustments = existing?.adjustments.filter((item) => item.status === "APPROVED") ?? [];
    const adjustmentMinutes = adjustments.reduce(
      (total, item) => total + signedMinutes(item.type, item.minutes),
      0,
    );
    const lineFingerprint = hash(
      `${facts.fingerprint}|${dateKey(day.businessDate)}|${day.sessions.map((item) => item.id).join(",")}`,
    );
    const line = await tx.timesheetLine.upsert({
      where: { timesheetId_businessDate: { timesheetId, businessDate: day.businessDate } },
      update: {
        workedMinutes: day.workedMinutes,
        breakMinutes: day.breakMinutes,
        sessionCount: day.sessionCount,
        scheduledMinutes: day.scheduledMinutes,
        attendanceIssueCount: day.attendanceIssueCount,
        needsReview: day.needsReview,
        adjustmentMinutes,
        regularPayableMinutes: day.workedMinutes + adjustmentMinutes,
        totalPayableMinutes: day.workedMinutes + adjustmentMinutes,
        sourceFingerprint: lineFingerprint,
      },
      create: {
        timesheetId,
        businessDate: day.businessDate,
        workedMinutes: day.workedMinutes,
        breakMinutes: day.breakMinutes,
        sessionCount: day.sessionCount,
        scheduledMinutes: day.scheduledMinutes,
        attendanceIssueCount: day.attendanceIssueCount,
        needsReview: day.needsReview,
        adjustmentMinutes,
        regularPayableMinutes: day.workedMinutes + adjustmentMinutes,
        totalPayableMinutes: day.workedMinutes + adjustmentMinutes,
        sourceFingerprint: lineFingerprint,
      },
    });
    await tx.timesheetLineWorkSession.deleteMany({ where: { timesheetLineId: line.id } });
    if (day.sessions.length)
      await tx.timesheetLineWorkSession.createMany({
        data: day.sessions.map((session) => ({
          timesheetLineId: line.id,
          workSessionId: session.id,
        })),
      });
  }
  const lines = await tx.timesheetLine.findMany({ where: { timesheetId } });
  const baseWorkedMinutes = lines.reduce(
    (sum, line) => sum + line.workedMinutes,
    0,
  );
  const adjustmentMinutes = lines.reduce(
    (sum, line) => sum + line.adjustmentMinutes,
    0,
  );
  const effectiveMinutes = lines.reduce(
    (sum, line) => sum + line.totalPayableMinutes,
    0,
  );
  if (
    timesheet.sourceFingerprint === facts.fingerprint &&
    timesheet.baseWorkedMinutes === baseWorkedMinutes &&
    timesheet.adjustmentMinutes === adjustmentMinutes &&
    timesheet.effectiveMinutes === effectiveMinutes
  )
    return timesheet;
  return tx.timesheet.update({
    where: { id: timesheetId },
    data: {
      baseWorkedMinutes,
      adjustmentMinutes,
      effectiveMinutes,
      sourceFingerprint: facts.fingerprint,
      version: { increment: 1 },
    },
  });
}

export async function ensureAndRecomputeTimesheet(employmentId: string, inputDate: Date) {
  const periodStart = mondayOf(inputDate);
  return transaction(async (tx) => {
    const timesheet = await ensureTimesheetTx(tx, employmentId, periodStart);
    await recomputeTx(tx, timesheet.id);
    return tx.timesheet.findUniqueOrThrow({
      where: { id: timesheet.id },
      include: {
        employment: { include: { employee: true } },
        payrollPeriod: true,
        lines: {
          include: {
            adjustments: true,
            workSessionLinks: {
              include: { workSession: { include: { branch: true, shift: true, attendanceExceptions: true } } },
            },
          },
          orderBy: { businessDate: "asc" },
        },
      },
    });
  });
}

export async function signalTimesheetsForEmployment(tx: Tx, employmentId: string) {
  const sheets = await tx.timesheet.findMany({ where: { employmentId } });
  for (const sheet of sheets) await recomputeTx(tx, sheet.id);
}

export async function addTimesheetAdjustment(
  actor: TimesheetActor,
  input: { lineId: string; type: "ADD_PAYABLE_TIME" | "REMOVE_PAYABLE_TIME"; minutes: number; reason: string; idempotencyKey: string; expectedVersion: number },
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 24 * 60)
    throw new Error("Minutos de ajuste inválidos.");
  if (input.reason.trim().length < 5) throw new Error("Razón obligatoria.");
  if (!input.idempotencyKey) throw new Error("Idempotency key obligatoria.");
  return transaction(async (tx) => {
    const duplicate = await tx.timesheetAdjustment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (
        duplicate.timesheetLineId !== input.lineId ||
        duplicate.type !== input.type ||
        duplicate.minutes !== input.minutes
      )
        throw new Error("Idempotency key reutilizada con otra operación.");
      return { adjustment: duplicate, idempotent: true };
    }
    const line = await tx.timesheetLine.findUnique({ where: { id: input.lineId }, include: { timesheet: true } });
    if (!line) throw new Error("Línea no encontrada.");
    if (!actor.accessibleBranchIds && actor.role !== "ADMIN") throw new Error("No autorizado.");
    if (!['OPEN', 'REVIEW'].includes(line.timesheet.status)) throw new Error("Timesheet no editable.");
    if (line.timesheet.version !== input.expectedVersion) throw new Error("STALE_VERSION");
    if (
      line.totalPayableMinutes + signedMinutes(input.type, input.minutes) <
      0
    )
      throw new Error("El ajuste no puede producir minutos negativos.");
    const adjustment = await tx.timesheetAdjustment.create({
      data: { timesheetLineId: line.id, type: input.type, minutes: input.minutes, reason: input.reason.trim(), status: "APPROVED", createdById: actor.id, approvedById: actor.id, approvedAt: new Date(), idempotencyKey: input.idempotencyKey },
    });
    await recomputeTx(tx, line.timesheetId);
    return { adjustment, idempotent: false };
  });
}

export async function approveTimesheet(
  actor: TimesheetActor,
  input: { timesheetId: string; expectedVersion: number; idempotencyKey: string },
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  return transaction(async (tx) => {
    const duplicate = await tx.timesheet.findUnique({ where: { approvalIdempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (duplicate.id !== input.timesheetId)
        throw new Error("Idempotency key reutilizada con otro Timesheet.");
      return { timesheet: duplicate, idempotent: true };
    }
    await recomputeTx(tx, input.timesheetId);
    const sheet = await tx.timesheet.findUniqueOrThrow({
      where: { id: input.timesheetId },
      include: { lines: true },
    });
    if (!['OPEN', 'REVIEW'].includes(sheet.status)) throw new Error("Timesheet no aprobable.");
    if (sheet.version !== input.expectedVersion) throw new Error("STALE_VERSION");
    const issues = await tx.attendanceException.findMany({ where: { employmentId: sheet.employmentId, businessDate: { gte: sheet.periodStart, lte: sheet.periodEnd }, status: "OPEN" } });
    const incompleteSessions = await tx.workSession.count({ where: { employmentId: sheet.employmentId, businessDate: { gte: sheet.periodStart, lte: sheet.periodEnd }, status: { not: "COMPLETE" } } });
    const blockers = new Set(["MISSING_CLOCK_IN", "MISSING_CLOCK_OUT", "INCOMPLETE_BREAK"]);
    const readiness = timesheetReadiness(sheet.lines.map((line) => ({ needsReview: line.needsReview, blocking: line.needsReview && issues.some((issue) => dateKey(issue.businessDate) === dateKey(line.businessDate) && issue.severity === "CRITICAL" && blockers.has(issue.type)) })));
    if (readiness === "BLOCKED" || incompleteSessions > 0)
      throw new Error("Timesheet bloqueado por integridad de tiempo.");
    const updated = await tx.timesheet.update({
      where: { id: sheet.id },
      data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), approvalIdempotencyKey: input.idempotencyKey, approvedSourceFingerprint: sheet.sourceFingerprint, approvedBaseMinutes: sheet.baseWorkedMinutes, approvedAdjustmentMinutes: sheet.adjustmentMinutes, approvedEffectiveMinutes: sheet.effectiveMinutes, approvedIssuesSnapshot: issues.map((issue) => ({ type: issue.type, businessDate: dateKey(issue.businessDate), status: issue.status })), version: { increment: 1 } },
    });
    return { timesheet: updated, idempotent: false };
  });
}

export async function lockTimesheet(actor: TimesheetActor, input: { timesheetId: string; expectedVersion: number }) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  return transaction(async (tx) => {
    const sheet = await tx.timesheet.findUniqueOrThrow({ where: { id: input.timesheetId } });
    if (sheet.status === "LOCKED") return { timesheet: sheet, idempotent: true };
    if (sheet.status !== "APPROVED" || sheet.version !== input.expectedVersion) throw new Error("Timesheet no bloqueable o versión obsoleta.");
    const updated = await tx.timesheet.update({ where: { id: sheet.id }, data: { status: "LOCKED", lockedById: actor.id, lockedAt: new Date(), version: { increment: 1 } } });
    return { timesheet: updated, idempotent: false };
  });
}

export async function getOwnTimesheet(actor: { id: string }, inputDate: Date) {
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id }, include: { employments: true } });
  if (!employee) throw new Error("Employee no vinculado.");
  const start = mondayOf(inputDate), end = sundayOf(start);
  const candidates = employee.employments.filter((employment) => (!employment.startedAt || employment.startedAt <= end) && (!employment.endedAt || employment.endedAt >= start));
  if (candidates.length !== 1) throw new Error(candidates.length ? "Employment ambiguo." : "Sin Employment para el periodo.");
  return ensureAndRecomputeTimesheet(candidates[0].id, start);
}

export async function getTimesheetBoard(
  actor: TimesheetActor,
  inputDate: Date,
  search?: string,
  status?: string,
  branchId?: string,
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  if (
    branchId &&
    actor.accessibleBranchIds &&
    !actor.accessibleBranchIds.includes(branchId)
  )
    throw new Error("Sucursal no autorizada.");
  const start = mondayOf(inputDate), end = sundayOf(start);
  const where: Prisma.EmploymentWhereInput = {
    AND: [
      { OR: [{ startedAt: null }, { startedAt: { lte: end } }] },
      { OR: [{ endedAt: null }, { endedAt: { gte: start } }] },
      ...(search
        ? [
            {
              employee: {
                displayName: { contains: search, mode: "insensitive" as const },
              },
            },
          ]
        : []),
      ...(branchId
        ? [
            {
              OR: [
                {
                  workSessions: {
                    some: {
                      branchId,
                      businessDate: { gte: start, lte: end },
                    },
                  },
                },
                { branchAssignments: { some: { branchId } } },
              ],
            },
          ]
        : []),
    ],
  };
  const employments = await prisma.employment.findMany({
    where,
    include: { employee: true }, orderBy: { employee: { displayName: "asc" } },
  });
  const sheets = [];
  for (const employment of employments) {
    const sheet = await ensureAndRecomputeTimesheet(employment.id, start);
    if (!status || sheet.status === status) sheets.push(sheet);
  }
  const branches = await prisma.branch.findMany({
    where: {
      active: true,
      ...(actor.accessibleBranchIds
        ? { id: { in: actor.accessibleBranchIds } }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  return { start, end, sheets, branches };
}
