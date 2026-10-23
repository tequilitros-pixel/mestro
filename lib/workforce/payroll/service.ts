import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type WorkforcePayrollAdjustmentDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mondayOf, sundayOf } from "@/lib/workforce/timesheet/rules";
import { assertPayrollAdmin, calculatePayrollMoney, effectivePayRateBlocker } from "./rules";

type Tx = Prisma.TransactionClient;
export type PayrollActor = { id: string; role: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function transaction<T>(fn: (tx: Tx) => Promise<T>, attempt = 0): Promise<T> {
  try { return await prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 30_000,
  }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2)
      return transaction(fn, attempt + 1);
    throw error;
  }
}

async function sourceFacts(tx: Tx, timesheetId: string) {
  const sheet = await tx.timesheet.findUniqueOrThrow({
    where: { id: timesheetId },
    include: {
      employment: { include: { employee: true, payRates: true } },
      payrollPeriod: true,
      overtimeCalculation: { include: { lines: { orderBy: { businessDate: "asc" } } } },
      payrollLine: { include: {
        adjustments: true,
        rateSegments: true,
        retroAdjustments: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
        approvedBy: true,
        paidBy: true,
      } },
    },
  });
  if (sheet.payrollLine && (["APPROVED", "PAID"] as string[]).includes(sheet.payrollLine.status)) {
    const frozenWarnings = [
      ...(sheet.requiresAdjustment ? ["RETROACTIVE_REVIEW_REQUIRED"] : []),
      ...(sheet.overtimeCalculation?.status === "STALE" ? ["OVERTIME_STALE_AFTER_PAYROLL"] : []),
    ];
    return {
      sheet, overtime: sheet.overtimeCalculation, days: [], adjustments: sheet.payrollLine.adjustments,
      blockers: frozenWarnings, money: null, sourceFingerprint: sheet.payrollLine.sourceFingerprint,
    };
  }
  const blockers: string[] = [];
  if (!(["APPROVED", "LOCKED"] as string[]).includes(sheet.status)) blockers.push("TIMESHEET_NOT_APPROVED");
  if (sheet.requiresAdjustment) blockers.push("TIMESHEET_REQUIRES_ADJUSTMENT");
  const overtime = sheet.overtimeCalculation;
  if (!overtime) blockers.push("OVERTIME_MISSING");
  else if (overtime.status !== "FINAL") blockers.push("OVERTIME_NOT_FINAL");
  const days = [];
  if (overtime) for (const line of overtime.lines) {
    const rates = sheet.employment.payRates.filter((rate) =>
      rate.effectiveFrom <= line.businessDate && (!rate.effectiveTo || rate.effectiveTo >= line.businessDate));
    const rateBlocker = effectivePayRateBlocker(rates);
    if (rateBlocker) { blockers.push(rateBlocker); continue; }
    const rate = rates[0];
    if (rate.currency) days.push({
      businessDate: line.businessDate, payRateId: rate.id, rateType: rate.rateType,
      rate: rate.amount, currency: rate.currency,
      ordinaryMinutes: line.ordinaryMinutes, doubleMinutes: line.doubleMinutes, tripleMinutes: line.tripleMinutes,
    });
  }
  if (new Set(days.map((day) => day.currency)).size > 1) blockers.push("PAY_RATE_CURRENCY_MISMATCH");
  const uniqueBlockers = [...new Set(blockers)];
  const adjustments = sheet.payrollLine?.adjustments ?? [];
  const money = uniqueBlockers.length || !days.length ? null : calculatePayrollMoney(days, adjustments);
  const sourceFingerprint = hash(JSON.stringify({
    timesheetId: sheet.id, timesheetVersion: sheet.version,
    approvedSourceFingerprint: sheet.approvedSourceFingerprint,
    overtimeId: overtime?.id, overtimeFingerprint: overtime?.sourceFingerprint,
    rates: days.map((day) => [day.businessDate, day.payRateId, String(day.rate), day.currency]),
  }));
  return { sheet, overtime, days, adjustments, blockers: uniqueBlockers, money, sourceFingerprint };
}

async function refreshTx(tx: Tx, timesheetId: string) {
  const facts = await sourceFacts(tx, timesheetId);
  if (facts.blockers.length || !facts.money || !facts.overtime)
    return { ...facts, line: facts.sheet.payrollLine };
  const existing = facts.sheet.payrollLine;
  if (existing && (["APPROVED", "PAID"] as string[]).includes(existing.status))
    return { ...facts, line: existing };
  const first = facts.money.segments[0];
  const data = {
    payrollPeriodId: facts.sheet.payrollPeriodId, employmentId: facts.sheet.employmentId,
    timesheetId: facts.sheet.id, overtimeCalculationId: facts.overtime.id, status: "READY" as const,
    employeeNameSnapshot: facts.sheet.employment.employee.displayName ?? "Employee",
    rateTypeSnapshot: first.rateType, payRateAmountSnapshot: first.hourlyRate,
    currencySnapshot: facts.money.currency, regularMinutes: facts.money.ordinaryMinutes,
    overtimeTier1Minutes: facts.money.doubleMinutes, overtimeTier2Minutes: facts.money.tripleMinutes,
    overtimeTier1Multiplier: new Prisma.Decimal(2), overtimeTier2Multiplier: new Prisma.Decimal(3),
    ordinaryPay: facts.money.ordinaryPay, doublePay: facts.money.doublePay, triplePay: facts.money.triplePay,
    earningsAmount: facts.money.earningsAmount, deductionsAmount: facts.money.deductionsAmount,
    adjustmentAmount: facts.money.earningsAmount.sub(facts.money.deductionsAmount),
    grossAmount: facts.money.grossAmount, operationalPayable: facts.money.operationalPayable,
    timesheetVersion: facts.sheet.version, overtimePolicyVersion: facts.overtime.policyVersion,
    sourceFingerprint: facts.sourceFingerprint, calculatedAt: new Date(),
  };
  const line = existing
    ? await tx.payrollLine.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
    : await tx.payrollLine.create({ data });
  await tx.workforcePayrollRateSegment.deleteMany({ where: { payrollLineId: line.id } });
  await tx.workforcePayrollRateSegment.createMany({ data: facts.money.segments.map((segment) => ({
    payrollLineId: line.id, payRateId: segment.payRateId, businessDate: segment.businessDate,
    rateType: segment.rateType, hourlyRate: segment.hourlyRate, currency: segment.currency,
    ordinaryMinutes: segment.ordinaryMinutes, doubleMinutes: segment.doubleMinutes, tripleMinutes: segment.tripleMinutes,
    ordinaryPay: segment.ordinaryPay, doublePay: segment.doublePay, triplePay: segment.triplePay,
  })) });
  return { ...facts, line };
}

export async function calculatePayrollLine(actor: PayrollActor, timesheetId: string) {
  assertPayrollAdmin(actor);
  return transaction((tx) => refreshTx(tx, timesheetId));
}

export async function addPayrollAdjustment(actor: PayrollActor, input: {
  payrollLineId: string; categoryId: string; amount: string; reason: string; idempotencyKey: string;
}) {
  assertPayrollAdmin(actor);
  if (input.reason.trim().length < 5) throw new Error("La razón es obligatoria.");
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isPositive()) throw new Error("El monto debe ser positivo.");
  return transaction(async (tx) => {
    const duplicate = await tx.workforcePayrollLineAdjustment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) return { adjustment: duplicate, idempotent: true };
    const [line, category] = await Promise.all([
      tx.payrollLine.findUniqueOrThrow({ where: { id: input.payrollLineId } }),
      tx.workforcePayrollCategory.findUniqueOrThrow({ where: { id: input.categoryId } }),
    ]);
    if ((["APPROVED", "PAID"] as string[]).includes(line.status)) throw new Error("Payroll congelado; usa ajuste retroactivo.");
    if (!category.active) throw new Error("Categoría inactiva.");
    const adjustment = await tx.workforcePayrollLineAdjustment.create({ data: {
      payrollLineId: line.id, categoryId: category.id, categoryName: category.name,
      direction: category.direction, amount, reason: input.reason.trim(), createdById: actor.id,
      idempotencyKey: input.idempotencyKey,
    } });
    await refreshTx(tx, line.timesheetId);
    return { adjustment, idempotent: false };
  });
}

export async function approvePayrollLine(actor: PayrollActor, input: {
  payrollLineId: string; expectedVersion: number; idempotencyKey: string;
}) {
  assertPayrollAdmin(actor);
  return transaction(async (tx) => {
    const duplicate = await tx.payrollLine.findUnique({ where: { approvalIdempotencyKey: input.idempotencyKey } });
    if (duplicate) return { line: duplicate, idempotent: true };
    const initial = await tx.payrollLine.findUniqueOrThrow({ where: { id: input.payrollLineId } });
    if (initial.status === "APPROVED" || initial.status === "PAID") return { line: initial, idempotent: true };
    if (initial.version !== input.expectedVersion) throw new Error("STALE_VERSION");
    const refreshed = await refreshTx(tx, initial.timesheetId);
    if (refreshed.blockers.length || !refreshed.line) throw new Error(`PAYROLL_BLOCKED:${refreshed.blockers.join(",")}`);
    const line = await tx.payrollLine.update({ where: { id: refreshed.line.id }, data: {
      status: "APPROVED", approvedById: actor.id, approvedAt: new Date(),
      approvalIdempotencyKey: input.idempotencyKey, version: { increment: 1 },
    } });
    await tx.timesheet.update({ where: { id: line.timesheetId }, data: {
      status: "LOCKED", lockedById: actor.id, lockedAt: new Date(),
    } });
    return { line, idempotent: false };
  });
}

export async function approveReadyPayrollPeriod(actor: PayrollActor, input: {
  payrollPeriodId: string; idempotencyKey: string;
}) {
  assertPayrollAdmin(actor);
  return transaction(async (tx) => {
    const lines = await tx.payrollLine.findMany({ where: { payrollPeriodId: input.payrollPeriodId, status: "READY" } });
    for (const current of lines) {
      const refreshed = await refreshTx(tx, current.timesheetId);
      if (refreshed.blockers.length || !refreshed.line) throw new Error(`PAYROLL_BLOCKED:${refreshed.blockers.join(",")}`);
      await tx.payrollLine.update({ where: { id: refreshed.line.id }, data: {
        status: "APPROVED", approvedById: actor.id, approvedAt: new Date(),
        approvalIdempotencyKey: `${input.idempotencyKey}:${current.id}`, version: { increment: 1 },
      } });
      await tx.timesheet.update({ where: { id: current.timesheetId }, data: {
        status: "LOCKED", lockedById: actor.id, lockedAt: new Date(),
      } });
    }
    return { approved: lines.length };
  });
}

export async function markPayrollPaid(actor: PayrollActor, input: {
  payrollLineId: string; expectedVersion: number; idempotencyKey: string; reference?: string;
}) {
  assertPayrollAdmin(actor);
  return transaction(async (tx) => {
    const duplicate = await tx.payrollLine.findUnique({ where: { paymentIdempotencyKey: input.idempotencyKey } });
    if (duplicate) return { line: duplicate, idempotent: true };
    const current = await tx.payrollLine.findUniqueOrThrow({ where: { id: input.payrollLineId } });
    if (current.status === "PAID") return { line: current, idempotent: true };
    if (current.status !== "APPROVED") throw new Error("Payroll no aprobado.");
    if (current.version !== input.expectedVersion) throw new Error("STALE_VERSION");
    const line = await tx.payrollLine.update({ where: { id: current.id }, data: {
      status: "PAID", paidById: actor.id, paidAt: new Date(),
      paymentReference: input.reference?.trim() || null,
      paymentIdempotencyKey: input.idempotencyKey, version: { increment: 1 },
    } });
    return { line, idempotent: false };
  });
}

export async function createRetroactivePayrollAdjustment(actor: PayrollActor, input: {
  originalPayrollLineId: string; appliedPayrollPeriodId: string; amount: string; minutes?: number;
  reason: string; idempotencyKey: string;
}) {
  assertPayrollAdmin(actor);
  if (input.reason.trim().length < 5) throw new Error("La razón es obligatoria.");
  let amount: Prisma.Decimal;
  try { amount = new Prisma.Decimal(input.amount); }
  catch { throw new Error("Monto retroactivo inválido."); }
  if (amount.isZero()) throw new Error("El monto retroactivo no puede ser cero.");
  if (!amount.isFinite() || amount.decimalPlaces() > 2) throw new Error("El monto debe expresarse en centavos.");
  return transaction(async (tx) => {
    const duplicate = await tx.workforcePayrollAdjustment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) return { adjustment: duplicate, idempotent: true };
    const original = await tx.payrollLine.findUniqueOrThrow({ where: { id: input.originalPayrollLineId } });
    if (original.status !== "APPROVED" && original.status !== "PAID") throw new Error("Payroll original no congelado.");
    const adjustment = await tx.workforcePayrollAdjustment.create({ data: {
      originalPayrollLineId: original.id, appliedPayrollPeriodId: input.appliedPayrollPeriodId,
      amount, minutes: input.minutes, kind: "RETROACTIVE", reason: input.reason.trim(),
      status: "PENDING", createdById: actor.id, idempotencyKey: input.idempotencyKey,
    } });
    return { adjustment, idempotent: false };
  });
}

export async function createPayrollCategory(actor: PayrollActor, input: {
  name: string; direction: WorkforcePayrollAdjustmentDirection;
}) {
  assertPayrollAdmin(actor);
  if (input.name.trim().length < 2) throw new Error("Nombre inválido.");
  return prisma.workforcePayrollCategory.create({ data: { name: input.name.trim(), direction: input.direction, createdById: actor.id } });
}

export async function setPayrollCategoryActive(actor: PayrollActor, input: { id: string; active: boolean }) {
  assertPayrollAdmin(actor);
  return prisma.workforcePayrollCategory.update({ where: { id: input.id }, data: { active: input.active } });
}

export async function getPayrollBoard(inputDate: Date) {
  const start = mondayOf(inputDate), end = sundayOf(start);
  const sheets = await prisma.timesheet.findMany({
    where: { periodStart: start },
    include: { employment: { include: { employee: true } }, payrollLine: true },
    orderBy: { employment: { employee: { displayName: "asc" } } },
  });
  const facts = await Promise.all(sheets.map((sheet) =>
    prisma.$transaction((tx) => sourceFacts(tx, sheet.id))));
  const rows = sheets.map((sheet, index) => ({ sheet, facts: facts[index] }));
  const policy = await prisma.workforcePolicyVersion.findFirstOrThrow({ where: { effectiveFrom: { lte: start } }, orderBy: { effectiveFrom: "desc" } });
  const [categories, settlementPeriods] = await Promise.all([
    prisma.workforcePayrollCategory.findMany({ where: { active: true }, orderBy: [{ direction: "asc" }, { name: "asc" }] }),
    prisma.payrollPeriod.findMany({ where: { weekStart: { gte: start } }, orderBy: { weekStart: "asc" }, take: 12 }),
  ]);
  return { start, end, payDay: new Date(end.getTime() + ((policy.payDay + 7 - end.getUTCDay()) % 7) * 86_400_000), rows, categories, settlementPeriods };
}

export async function getEmployeePayrollStatements(userId: string) {
  return prisma.payrollLine.findMany({
    where: { employment: { employee: { userId } }, status: { in: ["APPROVED", "PAID"] } },
    include: { payrollPeriod: true, rateSegments: true, adjustments: true },
    orderBy: { payrollPeriod: { weekStart: "desc" } },
  });
}

export async function getEmployeePayrollStatement(userId: string, payrollLineId: string) {
  return prisma.payrollLine.findFirst({
    where: {
      id: payrollLineId,
      employment: { employee: { userId } },
      status: { in: ["APPROVED", "PAID"] },
    },
    include: { payrollPeriod: true, rateSegments: true, adjustments: true },
  });
}
