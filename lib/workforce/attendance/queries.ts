import "server-only";
import { prisma } from "@/lib/prisma";
import { canAccessAttendanceBranch } from "./evaluate";
import { reconcileAttendanceScope } from "./reconcile";

export type AttendanceActor = {
  id: string;
  role: string;
  accessibleBranchIds: string[] | null;
};
const allowedTypes = new Set([
  "LATE_ARRIVAL",
  "EARLY_DEPARTURE",
  "NO_SHOW",
  "UNSCHEDULED_WORK",
  "MISSING_CLOCK_IN",
  "MISSING_CLOCK_OUT",
  "INCOMPLETE_BREAK",
  "LONG_BREAK",
]);
const allowedSeverities = new Set(["INFO", "WARNING", "CRITICAL"]);
const allowedStatuses = new Set(["OPEN", "RESOLVED", "DISMISSED"]);

export async function getAttendanceCenter(
  actor: AttendanceActor,
  input: {
    start: Date;
    end: Date;
    branchId?: string;
    employee?: string;
    type?: string;
    severity?: string;
    status?: string;
  },
) {
  if (input.start > input.end) throw new Error("Rango de fechas inválido.");
  if (input.end.getTime() - input.start.getTime() > 93 * 86_400_000)
    throw new Error("El rango máximo es de 93 días.");
  if (input.type && !allowedTypes.has(input.type))
    throw new Error("Tipo de excepción inválido.");
  if (input.severity && !allowedSeverities.has(input.severity))
    throw new Error("Severidad inválida.");
  if (input.status && !allowedStatuses.has(input.status))
    throw new Error("Estado inválido.");
  if (
    input.branchId &&
    !canAccessAttendanceBranch(
      actor.role,
      actor.accessibleBranchIds,
      input.branchId,
    )
  )
    throw new Error("Sucursal no autorizada.");
  const branchIds = input.branchId
    ? [input.branchId]
    : actor.role === "ADMIN"
      ? undefined
      : (actor.accessibleBranchIds ?? []);
  await reconcileAttendanceScope({
    start: input.start,
    end: input.end,
    branchIds,
  });
  const where = {
    businessDate: { gte: input.start, lte: input.end },
    ...(branchIds ? { branchId: { in: branchIds } } : {}),
    ...(input.employee
      ? {
          employment: {
            employee: {
              displayName: { contains: input.employee, mode: "insensitive" as const },
            },
          },
        }
      : {}),
    ...(input.type ? { type: input.type as never } : {}),
    ...(input.severity ? { severity: input.severity as never } : {}),
    ...(input.status ? { status: input.status as never } : {}),
  };
  const [items, openCount, criticalCount, branches] = await Promise.all([
    prisma.attendanceException.findMany({
      where,
      include: {
        employment: { include: { employee: true } },
        branch: true,
        shift: true,
        workSession: {
          include: {
            clockEventLinks: {
              include: { clockEvent: true },
              orderBy: { sequence: "asc" },
            },
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { severity: "desc" },
        { businessDate: "desc" },
        { detectedAt: "asc" },
      ],
    }),
    prisma.attendanceException.count({
      where: { ...where, status: "OPEN" },
    }),
    prisma.attendanceException.count({
      where: { ...where, status: "OPEN", severity: "CRITICAL" },
    }),
    prisma.branch.findMany({
      where: {
        active: true,
        ...(branchIds ? { id: { in: branchIds } } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const byType = new Map<string, number>();
  const byBranch = new Map<string, number>();
  for (const item of items.filter((item) => item.status === "OPEN")) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    byBranch.set(item.branch.name, (byBranch.get(item.branch.name) ?? 0) + 1);
  }
  return {
    items,
    branches,
    summary: {
      openCount,
      criticalCount,
      byType: Object.fromEntries(byType),
      byBranch: Object.fromEntries(byBranch),
    },
  };
}
