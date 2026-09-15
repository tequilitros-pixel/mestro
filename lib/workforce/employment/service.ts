import "server-only";
import { Prisma, type BranchAssignmentType, type DataConfidence, type EmploymentStatus, type WorkforceRateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertNativeCurrency, assertValidRange, rangesOverlap } from "./rules";

export type CreateEmployeeInput = {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  employeeNumber?: string | null;
  userId?: string | null;
  active?: boolean;
  employment?: {
    status: EmploymentStatus;
    startedAt?: Date | null;
    dataConfidence: DataConfidence;
    homeBranchId?: string | null;
    allowedBranchIds?: string[];
    effectiveFrom: Date;
    payRate?: { rateType: WorkforceRateType; amount: number; currency: string; effectiveFrom: Date };
  };
};

export async function listEmployees() {
  const now = new Date();
  return prisma.employee.findMany({
    include: {
      user: { select: { id: true, username: true } },
      employments: {
        orderBy: { createdAt: "desc" },
        include: {
          branchAssignments: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, include: { branch: true } },
          payRates: { where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { effectiveFrom: "desc" } },
        },
      },
    },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });
}

export async function getEmployee(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, name: true } },
      employments: {
        orderBy: { createdAt: "desc" },
        include: {
          branchAssignments: { include: { branch: true }, orderBy: { effectiveFrom: "desc" } },
          payRates: { orderBy: { effectiveFrom: "desc" } },
        },
      },
    },
  });
}

export async function createEmployee(input: CreateEmployeeInput) {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("El nombre visible es obligatorio.");
  if (input.employment?.payRate) assertNativeCurrency(input.employment.payRate.currency);
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({ data: { displayName, firstName: input.firstName?.trim() || null, lastName: input.lastName?.trim() || null, employeeNumber: input.employeeNumber?.trim() || null, userId: input.userId || null, active: input.active ?? true } });
    if (!input.employment) return employee;
    const employment = await tx.employment.create({ data: { employeeId: employee.id, status: input.employment.status, startedAt: input.employment.startedAt ?? null, dataConfidence: input.employment.dataConfidence } });
    if (input.employment.homeBranchId) await tx.branchAssignment.create({ data: { employmentId: employment.id, branchId: input.employment.homeBranchId, type: "HOME", effectiveFrom: input.employment.effectiveFrom } });
    const allowed = [...new Set(input.employment.allowedBranchIds ?? [])].filter((id) => id !== input.employment!.homeBranchId);
    if (allowed.length) await tx.branchAssignment.createMany({ data: allowed.map((branchId) => ({ employmentId: employment.id, branchId, type: "ALLOWED" as const, effectiveFrom: input.employment!.effectiveFrom })) });
    if (input.employment.payRate) await tx.payRate.create({ data: { employmentId: employment.id, ...input.employment.payRate } });
    return employee;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function addBranchAssignment(input: { employmentId: string; branchId: string; type: BranchAssignmentType; effectiveFrom: Date; effectiveTo?: Date | null }) {
  assertValidRange({ effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null });
  return prisma.$transaction(async (tx) => {
    const existing = await tx.branchAssignment.findMany({ where: { employmentId: input.employmentId, type: input.type } });
    const candidate = { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null };
    if (input.type === "HOME" && existing.some((row) => rangesOverlap(row, candidate))) throw new Error("Ya existe una asignación HOME vigente en ese rango.");
    return tx.branchAssignment.create({ data: { ...input, effectiveTo: input.effectiveTo ?? null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changeHomeBranch(input: { employmentId: string; branchId: string; effectiveFrom: Date }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.branchAssignment.findMany({ where: { employmentId: input.employmentId, type: "HOME", effectiveFrom: { lt: input.effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] } });
    await Promise.all(current.map((row) => tx.branchAssignment.update({ where: { id: row.id }, data: { effectiveTo: input.effectiveFrom } })));
    const overlaps = await tx.branchAssignment.findMany({ where: { employmentId: input.employmentId, type: "HOME" } });
    if (overlaps.some((row) => rangesOverlap(row, { effectiveFrom: input.effectiveFrom, effectiveTo: null }))) throw new Error("El nuevo HOME se traslapa con historia futura.");
    return tx.branchAssignment.create({ data: { employmentId: input.employmentId, branchId: input.branchId, type: "HOME", effectiveFrom: input.effectiveFrom } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changePayRate(input: { employmentId: string; rateType: WorkforceRateType; amount: number; currency: string; effectiveFrom: Date }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto debe ser mayor que cero.");
  assertNativeCurrency(input.currency);
  return prisma.$transaction(async (tx) => {
    const current = await tx.payRate.findMany({ where: { employmentId: input.employmentId, rateType: input.rateType, effectiveFrom: { lt: input.effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }] } });
    const previousInstant = new Date(input.effectiveFrom.getTime() - 1);
    await Promise.all(current.map((row) => tx.payRate.update({ where: { id: row.id }, data: { effectiveTo: previousInstant } })));
    const history = await tx.payRate.findMany({ where: { employmentId: input.employmentId, rateType: input.rateType } });
    if (history.some((row) => rangesOverlap(row, { effectiveFrom: input.effectiveFrom, effectiveTo: null }))) throw new Error("La tarifa se traslapa con historia futura.");
    return tx.payRate.create({ data: input });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function changeEmploymentStatus(input: { employmentId: string; status: EmploymentStatus; effectiveAt: Date; terminationReason?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const employment = await tx.employment.findUniqueOrThrow({ where: { id: input.employmentId } });
    if (input.status === "ACTIVE") {
      const anotherActive = await tx.employment.count({ where: { employeeId: employment.employeeId, status: "ACTIVE", id: { not: employment.id } } });
      if (anotherActive) throw new Error("El empleado ya tiene otra relación laboral activa.");
    }
    return tx.employment.update({ where: { id: input.employmentId }, data: { status: input.status, endedAt: input.status === "ACTIVE" ? null : input.effectiveAt, terminationReason: input.status === "TERMINATED" ? input.terminationReason?.trim() || null : null } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function rehireEmployee(input: { employeeId: string; startedAt: Date; dataConfidence: DataConfidence }) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.employment.count({ where: { employeeId: input.employeeId, status: "ACTIVE" } });
    if (active) throw new Error("El empleado ya tiene una relación laboral activa.");
    return tx.employment.create({ data: { employeeId: input.employeeId, status: "ACTIVE", startedAt: input.startedAt, dataConfidence: input.dataConfidence } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
