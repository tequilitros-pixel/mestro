"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import {
  payrollBusinessDate,
  payrollWeekInstantRange,
} from "@/lib/payroll/legacyRules";
import { resolveBranchHourlyRate } from "@/lib/payroll/branchRates";
import type { PayrollDayDetail } from "./payroll";

// ─── Local helpers (mirrored from payroll.ts — not exported from there) ───────

/** Convierte "HH:MM" a minutos desde medianoche. */
function minutesFromHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Minutos desde medianoche EN HORA DE MÉXICO. Usamos formatToParts para
 * no depender de la zona horaria del proceso (Vercel usa UTC en prod).
 */
function minutesOfDayInMexicoCity(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function hoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function weekDayKeys(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(mondayStr, i));
}

// ─── Return type ──────────────────────────────────────────────────────────────

export type EmployeeSelfWeekDetail = {
  weekStart: string;
  weekEnd: string;
  days: PayrollDayDetail[];
  totalHours: number;
  totalPay: number | null;
  status: "PAGADA" | "APROBADA" | "PENDIENTE";
  isFrozen: boolean;
};

// ─── Server action ────────────────────────────────────────────────────────────

/**
 * Devuelve el detalle día a día (turno programado vs. asistencia real e
 * incidencias) y el pago acumulado o congelado de la semana para el
 * empleado autenticado.
 *
 * @param weekStart  Lunes de la semana en formato "YYYY-MM-DD".
 *                   Por defecto usa el lunes de la semana actual.
 */
export async function getEmployeeSelfWeekDetail(
  weekStart?: string,
): Promise<{ success: true; data: EmployeeSelfWeekDetail } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "No autenticado" };
  }

  const mondayStr = weekStart ?? mondayOfWeek(todayDateOnly());
  const dayKeys = weekDayKeys(mondayStr);
  const weekStartDate = parseDateOnly(mondayStr);
  const weekEndDate = parseDateOnly(addDaysToDateOnly(mondayStr, 7));
  const { start: clockStart, end: clockEnd } = payrollWeekInstantRange(mondayStr);

  // ── Queries ──────────────────────────────────────────────────────────────
  const [entries, shifts, justifications, existingEntry, salaryRates, dbUser] = await Promise.all([
    prisma.timeClockEntry.findMany({
      where: { userId: user.id, clockIn: { gte: clockStart, lt: clockEnd } },
      include: { branch: { select: { name: true } } },
      orderBy: { clockIn: "asc" },
    }),
    prisma.scheduledShift.findMany({
      where: {
        userId: user.id,
        type: "TURNO",
        date: { gte: weekStartDate, lt: weekEndDate },
      },
      include: { branch: { select: { name: true } } },
    }),
    prisma.payrollIncidentJustification.findMany({
      where: {
        userId: user.id,
        date: { gte: weekStartDate, lt: weekEndDate },
      },
      include: { justifiedBy: { select: { name: true } } },
    }),
    prisma.payrollEntry.findFirst({
      where: {
        userId: user.id,
        period: { weekStart: weekStartDate },
      },
      select: {
        status: true,
        totalPay: true,
        period: { select: { status: true } },
      },
    }),
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

  // ── Index by day ──────────────────────────────────────────────────────────
  const entriesByDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = payrollBusinessDate(entry.clockIn);
    const list = entriesByDay.get(key) ?? [];
    list.push(entry);
    entriesByDay.set(key, list);
  }

  const shiftsByDay = new Map<string, (typeof shifts)[number]>();
  for (const shift of shifts) {
    shiftsByDay.set(formatDateOnly(shift.date), shift);
  }

  const justificationsByDay = new Map<string, { notes: string | null; justifiedByName: string }>();
  for (const j of justifications) {
    justificationsByDay.set(formatDateOnly(j.date), {
      notes: j.notes,
      justifiedByName: j.justifiedBy.name,
    });
  }

  // ── Build day details ─────────────────────────────────────────────────────
  const days: PayrollDayDetail[] = dayKeys.map((dateKey) => {
    const dayEntries = entriesByDay.get(dateKey) ?? [];
    const shift = shiftsByDay.get(dateKey) ?? null;

    const closedEntries = dayEntries.filter((e) => e.clockOut);
    const hoursWorked = closedEntries.reduce(
      (sum, e) => sum + hoursBetween(e.clockIn, e.clockOut!),
      0,
    );

    const firstEntry = dayEntries[0] ?? null;
    const lastClosedEntry = closedEntries[closedEntries.length - 1] ?? null;
    const hasOpenEntry = dayEntries.some((e) => !e.clockOut);

    // Incident detection — mirrors computeLiveEmployeeDetail exactly
    let incident: PayrollDayDetail["incident"] = null;
    if (hasOpenEntry) {
      incident = "SIN_SALIDA";
    } else if (firstEntry && !shift) {
      incident = "SIN_TURNO";
    } else if (shift && dayEntries.length === 0) {
      incident = "TURNO_NO_TRABAJADO";
    } else if (shift && firstEntry && shift.startTime) {
      const scheduledMinutes = minutesFromHHMM(shift.startTime);
      const actualMinutes = minutesOfDayInMexicoCity(firstEntry.clockIn);
      if (actualMinutes - scheduledMinutes > 10) {
        incident = "LLEGADA_TARDE";
      }
    }

    if (!incident && shift && lastClosedEntry && shift.endTime) {
      const scheduledEndMinutes = minutesFromHHMM(shift.endTime);
      const actualEndMinutes = minutesOfDayInMexicoCity(lastClosedEntry.clockOut!);
      if (scheduledEndMinutes - actualEndMinutes > 10) {
        incident = "SALIDA_ANTICIPADA";
      }
    }

    // Entries without pay/rate info (employee-facing: no wage data)
    const dayShiftEntries: PayrollDayDetail["entries"] = dayEntries.map((entry) => ({
      id: entry.id,
      branchId: entry.branchId,
      branchName: entry.branch.name,
      clockIn: entry.clockIn.toISOString(),
      clockOut: entry.clockOut ? entry.clockOut.toISOString() : null,
      source: entry.source,
    }));

    const justification = justificationsByDay.get(dateKey) ?? null;

    return {
      date: dateKey,
      scheduled: shift
        ? {
            branchName: shift.branch?.name ?? "Sin sucursal",
            startTime: shift.startTime ?? "—",
            endTime: shift.endTime ?? "—",
          }
        : null,
      actual: firstEntry
        ? {
            branchName: firstEntry.branch.name,
            clockIn: firstEntry.clockIn.toISOString(),
            clockOut: lastClosedEntry?.clockOut?.toISOString() ?? null,
            source: firstEntry.source,
          }
        : null,
      entries: dayShiftEntries,
      hoursWorked,
      incident,
      justified: justification !== null,
      justifiedNotes: justification?.notes ?? null,
      justifiedByName: justification?.justifiedByName ?? null,
    };
  });

  const totalHours = days.reduce((sum, d) => sum + d.hoursWorked, 0);

  // Determinar pago y estado de la semana
  let totalPay: number | null = null;
  let status: "PAGADA" | "APROBADA" | "PENDIENTE" = "PENDIENTE";
  let isFrozen = false;

  if (existingEntry && (existingEntry.status === "PAGADA" || existingEntry.status === "APROBADA" || existingEntry.period.status === "PAGADA" || existingEntry.period.status === "APROBADA")) {
    totalPay = Number(existingEntry.totalPay);
    status = existingEntry.status === "PAGADA" || existingEntry.period.status === "PAGADA" ? "PAGADA" : "APROBADA";
    isFrozen = true;
  } else {
    // Cálculo estimado con las tarifas vigentes del colaborador
    const rates = salaryRates.map((r) => ({ ...r, amount: Number(r.amount) }));
    const baseRate = dbUser?.hourlyRate !== null && dbUser?.hourlyRate !== undefined ? Number(dbUser.hourlyRate) : null;

    let computedPay = 0;
    let hasApplicableRate = baseRate !== null;

    for (const entry of entries) {
      if (!entry.clockOut) continue;
      const hours = hoursBetween(entry.clockIn, entry.clockOut);
      if (!(hours > 0)) continue;

      const rate = resolveBranchHourlyRate(rates, entry.branchId, entry.clockIn, baseRate);
      if (rate !== null) {
        hasApplicableRate = true;
        computedPay += hours * rate;
      }
    }

    totalPay = hasApplicableRate ? Math.round(computedPay * 100) / 100 : null;
    status = "PENDIENTE";
    isFrozen = false;
  }

  return {
    success: true,
    data: {
      weekStart: mondayStr,
      weekEnd: addDaysToDateOnly(mondayStr, 6),
      days,
      totalHours,
      totalPay,
      status,
      isFrozen,
    },
  };
}
