import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type WorkforceJornadaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mondayOf, sundayOf } from "@/lib/workforce/timesheet/rules";
import { resolveWorkforcePolicy } from "@/lib/workforce/settings/service";
import { classifyOvertimeWeek } from "./rules";

export type OvertimeActor = { id: string; role: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const DAY = 86_400_000;

async function calculationFacts(tx: Prisma.TransactionClient, timesheetId: string) {
  const timesheet = await tx.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: {
      employment: { include: { employee: true, jornadaPolicies: true } },
      lines: { orderBy: { businessDate: "asc" } },
      overtimeCalculation: { include: { lines: { orderBy: { businessDate: "asc" } }, workforcePolicyVersion: true } },
    },
  });
  const startPolicy = await resolveWorkforcePolicy(timesheet.periodStart, tx);
  const endPolicy = await resolveWorkforcePolicy(timesheet.periodEnd, tx);
  if (startPolicy.id !== endPolicy.id)
    throw new Error("OVERTIME_POLICY_CHANGE_MID_PERIOD");
  const result = classifyOvertimeWeek({
    lines: timesheet.lines.map((line) => ({
      timesheetLineId: line.id,
      businessDate: line.businessDate,
      approvedMinutes: line.totalPayableMinutes,
    })),
    jornadaPolicies: timesheet.employment.jornadaPolicies,
    legalPolicy: {
      version: startPolicy.legalPolicyCode,
      ordinaryDailyLimitMinutes: {
        DAY: startPolicy.legalDayOrdinaryLimitMinutes,
        NIGHT: startPolicy.legalNightOrdinaryLimitMinutes,
        MIXED: startPolicy.legalMixedOrdinaryLimitMinutes,
      },
      weeklyDoubleLimitMinutes: startPolicy.legalWeeklyDoubleLimitMinutes,
    },
  });
  const sourceFingerprint = hash(JSON.stringify({
    timesheetId: timesheet.id,
    approvedAt: timesheet.approvedAt,
    approvedMinutes: timesheet.approvedEffectiveMinutes,
    approvedSourceFingerprint: timesheet.approvedSourceFingerprint,
    policyId: startPolicy.id,
    jornada: result.lines.map((line) => [line.businessDate, line.jornadaPolicyId, line.jornadaType, line.ordinaryLimitMinutes]),
  }));
  return { timesheet, policy: startPolicy, result, sourceFingerprint };
}

export async function previewOvertime(timesheetId: string) {
  return prisma.$transaction(async (tx) => {
    const stored = await tx.timesheet.findUniqueOrThrow({
      where: { id: timesheetId },
      include: {
        employment: { include: { employee: true } },
        lines: { orderBy: { businessDate: "asc" } },
        overtimeCalculation: {
          include: {
            lines: { orderBy: { businessDate: "asc" } },
            workforcePolicyVersion: true,
          },
        },
      },
    });
    const final = stored.overtimeCalculation;
    if (final) {
      return {
        mode: stored.requiresAdjustment || final.status === "STALE" ? "STALE" : "FINAL",
        timesheet: stored,
        policy: final.workforcePolicyVersion,
        result: {
          policyVersion: final.policyVersion,
          weeklyDoubleLimitMinutes: final.weeklyDoubleLimitMinutes,
          approvedMinutes: final.approvedMinutes,
          ordinaryMinutes: final.ordinaryMinutes,
          doubleMinutes: final.doubleMinutes,
          tripleMinutes: final.tripleMinutes,
          lines: final.lines,
        },
      };
    }
    const facts = await calculationFacts(tx, timesheetId);
    return {
      mode: "PREVIEW",
      timesheet: facts.timesheet,
      policy: facts.policy,
      result: facts.result,
    };
  }, { maxWait: 5_000, timeout: 15_000 });
}

export async function finalizeOvertime(
  actor: OvertimeActor,
  input: { timesheetId: string; expectedTimesheetVersion: number },
  attempt = 0,
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  try {
    return await prisma.$transaction(async (tx) => {
      const facts = await calculationFacts(tx, input.timesheetId);
      const sheet = facts.timesheet;
      const existing = sheet.overtimeCalculation;
      if (existing) {
        const stale = sheet.requiresAdjustment || existing.sourceFingerprint !== facts.sourceFingerprint;
        if (stale && existing.status !== "STALE")
          await tx.workforceOvertimeCalculation.update({ where: { id: existing.id }, data: { status: "STALE" } });
        return { calculation: existing, idempotent: true, stale };
      }
      if (sheet.status !== "APPROVED" && sheet.status !== "LOCKED")
        throw new Error("TIMESHEET_NOT_APPROVED");
      if (!sheet.approvedAt || sheet.approvedEffectiveMinutes === null)
        throw new Error("TIMESHEET_APPROVAL_SNAPSHOT_MISSING");
      if (sheet.version !== input.expectedTimesheetVersion)
        throw new Error("STALE_VERSION");
      if (facts.result.approvedMinutes !== sheet.approvedEffectiveMinutes)
        throw new Error("TIMESHEET_LINE_SNAPSHOT_MISMATCH");
      const calculation = await tx.workforceOvertimeCalculation.create({
        data: {
          timesheetId: sheet.id,
          timesheetVersion: sheet.version,
          timesheetApprovedAt: sheet.approvedAt,
          approvedMinutes: facts.result.approvedMinutes,
          ordinaryMinutes: facts.result.ordinaryMinutes,
          doubleMinutes: facts.result.doubleMinutes,
          tripleMinutes: facts.result.tripleMinutes,
          weeklyDoubleLimitMinutes: facts.result.weeklyDoubleLimitMinutes,
          policyVersion: facts.result.policyVersion,
          workforcePolicyVersionId: facts.policy.id,
          sourceFingerprint: facts.sourceFingerprint,
          calculatedById: actor.id,
          lines: { create: facts.result.lines.map((line) => ({
            timesheetLineId: line.timesheetLineId,
            businessDate: line.businessDate,
            jornadaType: line.jornadaType,
            ordinaryLimitMinutes: line.ordinaryLimitMinutes,
            approvedMinutes: line.approvedMinutes,
            ordinaryMinutes: line.ordinaryMinutes,
            doubleMinutes: line.doubleMinutes,
            tripleMinutes: line.tripleMinutes,
            weeklyOvertimeBeforeMinutes: line.weeklyOvertimeBeforeMinutes,
            remainingDoubleBeforeMinutes: line.remainingDoubleBeforeMinutes,
            explanation: line.explanation,
          })) },
        },
        include: { lines: { orderBy: { businessDate: "asc" } } },
      });
      return { calculation, idempotent: false, stale: false };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 20_000,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034" &&
      attempt < 2
    )
      return finalizeOvertime(actor, input, attempt + 1);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const calculation = await prisma.workforceOvertimeCalculation.findUniqueOrThrow({ where: { timesheetId: input.timesheetId } });
      return { calculation, idempotent: true, stale: calculation.status === "STALE" };
    }
    throw error;
  }
}

export async function setEmploymentJornadaPolicy(
  actor: OvertimeActor,
  input: { employmentId: string; jornadaType: WorkforceJornadaType; effectiveFrom: Date },
) {
  if (actor.role !== "ADMIN") throw new Error("No autorizado.");
  if (Number.isNaN(input.effectiveFrom.getTime())) throw new Error("Fecha efectiva inválida.");
  return prisma.$transaction(async (tx) => {
    const employment = await tx.employment.findUnique({ where: { id: input.employmentId } });
    if (!employment) throw new Error("Employment no encontrado.");
    const existingAtDate = await tx.employmentJornadaPolicy.findFirst({
      where: { employmentId: input.employmentId, effectiveFrom: input.effectiveFrom },
    });
    if (existingAtDate) throw new Error("Ya existe una jornada para esa fecha.");
    const next = await tx.employmentJornadaPolicy.findFirst({
      where: { employmentId: input.employmentId, effectiveFrom: { gt: input.effectiveFrom } },
      orderBy: { effectiveFrom: "asc" },
    });
    const previous = await tx.employmentJornadaPolicy.findFirst({
      where: {
        employmentId: input.employmentId,
        effectiveFrom: { lt: input.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (previous)
      await tx.employmentJornadaPolicy.update({
        where: { id: previous.id },
        data: { effectiveTo: new Date(input.effectiveFrom.getTime() - DAY) },
      });
    return tx.employmentJornadaPolicy.create({
      data: {
        employmentId: input.employmentId,
        jornadaType: input.jornadaType,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: next ? new Date(next.effectiveFrom.getTime() - DAY) : null,
      },
    });
  });
}

export async function getOvertimeBoard(inputDate: Date, search?: string) {
  const start = mondayOf(inputDate), end = sundayOf(start);
  const sheets = await prisma.timesheet.findMany({
    where: {
      periodStart: start,
      ...(search ? { employment: { employee: { displayName: { contains: search, mode: "insensitive" } } } } : {}),
    },
    include: { employment: { include: { employee: true } } },
    orderBy: { employment: { employee: { displayName: "asc" } } },
  });
  const rows = [];
  for (const sheet of sheets) {
    try {
      rows.push({ ok: true as const, data: await previewOvertime(sheet.id) });
    } catch (error) {
      rows.push({ ok: false as const, sheet, error: error instanceof Error ? error.message : "OVERTIME_ERROR" });
    }
  }
  return { start, end, rows };
}
