"use server";

import { getCurrentUser } from "@/lib/auth";
import {
  formatDateOnly,
  mondayOfWeek,
  todayDateOnly,
  addDaysToDateOnly,
} from "@/lib/dateOnly";
import { prisma } from "@/lib/prisma";
import { payrollWeekInstantRange } from "@/lib/payroll/legacyRules";
import { resolveBranchHourlyRate } from "@/lib/payroll/branchRates";

/**
 * Snapshot que un trabajador puede consultar de su propia nómina. Los
 * importes y horas provienen de PayrollEntry si ya fue aprobada/pagada,
 * o del cálculo estimado de asistencia si la semana ya concluyó pero
 * administración aún no ha cerrado el periodo formalmente.
 */
export type ApprovedPayrollHistoryItem = {
  weekStart: string;
  weekEnd: string;
  status: "APROBADA" | "PAGADA" | "PENDIENTE";
  approvedAt: string | null;
  paidAt: string | null;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  totalPay: number;
};

/**
 * Historial de nómina del propio trabajador. Permite consultar semanas
 * aprobadas/pagadas y semanas concluidas recientes para que siempre
 * pueda saber cuánto se le pagó o calculó la semana pasada y antepasada.
 */
export async function getMyApprovedPayrollHistory(): Promise<
  { success: true; data: ApprovedPayrollHistoryItem[] } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "No autorizado" };

  // 1. Entradas de nómina formalmente registradas (aprobadas o pagadas,
  // ya sea a nivel de empleado individual o de periodo general).
  const entries = await prisma.payrollEntry.findMany({
    where: {
      userId: user.id,
      OR: [
        { status: { in: ["APROBADA", "PAGADA"] } },
        { period: { status: { in: ["APROBADA", "PAGADA"] } } },
      ],
    },
    select: {
      status: true,
      approvedAt: true,
      regularHours: true,
      overtimeHours: true,
      totalHours: true,
      totalPay: true,
      period: {
        select: {
          weekStart: true,
          weekEnd: true,
          status: true,
          approvedAt: true,
          paidAt: true,
        },
      },
    },
    orderBy: { period: { weekStart: "desc" } },
  });

  const coveredWeekStarts = new Set<string>();

  const historyItems: ApprovedPayrollHistoryItem[] = entries.map((entry) => {
    const weekStartStr = formatDateOnly(entry.period.weekStart);
    coveredWeekStarts.add(weekStartStr);

    const isPaid = entry.status === "PAGADA" || entry.period.status === "PAGADA";
    const status: "APROBADA" | "PAGADA" = isPaid ? "PAGADA" : "APROBADA";

    return {
      weekStart: weekStartStr,
      weekEnd: formatDateOnly(entry.period.weekEnd),
      status,
      approvedAt: (entry.approvedAt ?? entry.period.approvedAt)?.toISOString() ?? null,
      paidAt: entry.period.paidAt?.toISOString() ?? null,
      regularHours: Number(entry.regularHours),
      overtimeHours: Number(entry.overtimeHours),
      totalHours: Number(entry.totalHours),
      totalPay: Number(entry.totalPay),
    };
  });

  // 2. Verificar semanas pasadas recientes (últimas 8 semanas antes de la actual)
  // por si hubo turnos trabajados que administración aún no congela en PayrollEntry.
  const currentWeekMonday = mondayOfWeek(todayDateOnly());

  // Traer tarifas del usuario para calcular semanas pasadas si aplica
  const [salaryRates, dbUser] = await Promise.all([
    prisma.salaryRate.findMany({
      where: { userId: user.id, scheme: "HORA" },
      select: { branchId: true, amount: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { hourlyRate: true },
    }),
  ]);
  const rates = salaryRates.map((r) => ({ ...r, amount: Number(r.amount) }));
  const baseRate = dbUser?.hourlyRate !== null && dbUser?.hourlyRate !== undefined ? Number(dbUser.hourlyRate) : null;

  for (let i = 1; i <= 8; i++) {
    const mondayStr = addDaysToDateOnly(currentWeekMonday, -7 * i);
    if (coveredWeekStarts.has(mondayStr)) continue;

    const { start: clockStart, end: clockEnd } = payrollWeekInstantRange(mondayStr);

    const pastEntries = await prisma.timeClockEntry.findMany({
      where: {
        userId: user.id,
        clockIn: { gte: clockStart, lt: clockEnd },
      },
      select: {
        clockIn: true,
        clockOut: true,
        branchId: true,
      },
      orderBy: { clockIn: "asc" },
    });

    if (pastEntries.length === 0) continue;

    let weekHours = 0;
    let weekPay = 0;

    for (const entry of pastEntries) {
      if (!entry.clockOut) continue;
      const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      if (!(hours > 0)) continue;

      weekHours += hours;
      const appliedRate = resolveBranchHourlyRate(rates, entry.branchId, entry.clockIn, baseRate);
      weekPay += hours * (appliedRate ?? 0);
    }

    if (weekHours > 0) {
      historyItems.push({
        weekStart: mondayStr,
        weekEnd: addDaysToDateOnly(mondayStr, 6),
        status: "PENDIENTE",
        approvedAt: null,
        paidAt: null,
        regularHours: weekHours,
        overtimeHours: 0,
        totalHours: weekHours,
        totalPay: Math.round(weekPay * 100) / 100,
      });
    }
  }

  // Ordenar de la más reciente a la más antigua
  historyItems.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return {
    success: true,
    data: historyItems,
  };
}
