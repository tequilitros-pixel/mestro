"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPayrollSettings } from "@/app/actions/overtime";
import { splitTiers, computeAmount } from "@/lib/overtimeCalc";
import {
  addDaysToDateOnly,
  formatDateOnly,
  mondayOfWeek,
  parseDateOnly,
} from "@/lib/dateOnly";

/**
 * ==========================================================
 * MAESTRO — Nómina
 * ----------------------------------------------------------
 * "El horario programa, el reloj checador demuestra y la nómina
 * paga." Mientras una semana está en BORRADOR (o no existe fila de
 * PayrollPeriod todavía — se crea perezosamente, igual que
 * ScheduleWeek), la tabla y el expediente se calculan EN VIVO a
 * partir de TimeClockEntry, ScheduledShift, OvertimeRecord y
 * PayrollAdjustment: son números estimados.
 *
 * Al enviar la semana a revisión (fase 3), esos números se congelan
 * en PayrollEntry — un snapshot por empleado — y de ahí en adelante
 * se leen tal cual, aunque después alguien corrija una checada vieja.
 * Solo se puede volver a editar reabriendo la semana (REVISION o
 * APROBADA -> BORRADOR); una vez PAGADA queda cerrada por completo.
 * ==========================================================
 */

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

function hoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function minutesFromHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Minutos desde medianoche EN HORA DE MÉXICO. `Date.getHours()` usa
 * la zona horaria del proceso, que en desarrollo es México pero en
 * producción (Vercel) es UTC — comparar eso contra un horario
 * capturado como "10:00" (hora local, del `<input type="time">` de
 * Horario) daría un desfase de varias horas en producción. Por eso
 * siempre se formatea explícitamente en America/Mexico_City.
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

type RateRow = { amount: number; effectiveFrom: Date; effectiveTo: Date | null };

/**
 * Tarifa por hora vigente en una fecha, según el historial de
 * SalaryRate. Si el empleado nunca tuvo un cambio de sueldo desde que
 * existe el historial, cae de regreso a `User.hourlyRate` (así no se
 * pierde nada de lo que ya funcionaba antes de este historial).
 */
function resolveHourlyRate(rates: RateRow[], date: Date, fallback: number | null) {
  const match = rates.find(
    (r) => r.effectiveFrom <= date && (r.effectiveTo === null || r.effectiveTo > date),
  );
  return match ? match.amount : fallback;
}

const DAY_KEYS_MONDAY_FIRST = 7;

function weekDayKeys(mondayStr: string): string[] {
  return Array.from({ length: DAY_KEYS_MONDAY_FIRST }, (_, i) => addDaysToDateOnly(mondayStr, i));
}

/** Suma neta (bonos positivos, deducciones negativas) de los ajustes de una semana. */
function netAdjustmentAmount(rows: { type: string; amount: number }[]) {
  return rows.reduce(
    (sum, r) => sum + (r.type === "DEDUCCION" ? -r.amount : r.amount),
    0,
  );
}

export type PayrollPeriodStatusValue = "BORRADOR" | "REVISION" | "APROBADA" | "PAGADA";

export type PayrollPeriodInfo = {
  status: PayrollPeriodStatusValue;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  paidByName: string | null;
  paidAt: string | null;
  rejectedNotes: string | null;
};

export type PayrollWeekEmployee = {
  id: string;
  name: string;
  hourlyRate: number | null;
  missingRate: boolean;
  hoursByDay: number[];
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  estimatedPay: number;
  adjustmentsTotal: number;
  finalPay: number;
};

export type PayrollWeekTable = {
  weekStart: string;
  weekEnd: string;
  employees: PayrollWeekEmployee[];
  totals: {
    regularHours: number;
    overtimeHours: number;
    totalHours: number;
    employeesWorked: number;
    estimatedPay: number;
    adjustmentsTotal: number;
    finalPay: number;
  };
  period: PayrollPeriodInfo;
};

export type PayrollDayDetail = {
  date: string;
  scheduled: { branchName: string; startTime: string; endTime: string } | null;
  actual: { branchName: string; clockIn: string; clockOut: string | null; source: "CHECADOR" | "MANUAL" } | null;
  hoursWorked: number;
  incident: "SIN_SALIDA" | "SIN_TURNO" | "TURNO_NO_TRABAJADO" | "LLEGADA_TARDE" | "SALIDA_ANTICIPADA" | null;
  justified: boolean;
  justifiedNotes: string | null;
  justifiedByName: string | null;
};

export type PayrollAdjustmentRow = {
  id: string;
  type: "BONO" | "DEDUCCION";
  concept: string;
  amount: number;
  notes: string | null;
  createdByName: string;
  createdAt: string;
};

export type PayrollEmployeeDetail = {
  employee: { id: string; name: string; hourlyRate: number | null };
  weekStart: string;
  weekEnd: string;
  days: PayrollDayDetail[];
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  totalPay: number;
  adjustments: PayrollAdjustmentRow[];
  adjustmentsTotal: number;
  finalPay: number;
  period: PayrollPeriodInfo;
};

/**
 * Calcula EN VIVO (sin snapshot) las filas de la tabla semanal a
 * partir del checador, tarifas, tiempo extra y ajustes manuales.
 */
async function computeLiveWeekEmployees(mondayStr: string): Promise<{
  employees: PayrollWeekEmployee[];
  totals: PayrollWeekTable["totals"];
}> {
  const dayKeys = weekDayKeys(mondayStr);
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));
  // Un instante dentro de la semana (el domingo) para resolver qué
  // tarifa estaba vigente — ver nota en resolveHourlyRate.
  const rateReferenceDate = new Date(end.getTime() - 1);

  const [entries, employees, overtimeRecords, salaryRates, settings, adjustments] = await Promise.all([
    prisma.timeClockEntry.findMany({
      where: { clockIn: { gte: start, lt: end }, clockOut: { not: null } },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, hourlyRate: true },
      orderBy: { name: "asc" },
    }),
    prisma.overtimeRecord.findMany({
      where: { weekStart: start },
      select: { userId: true, overtimeHours: true, amount: true, status: true },
    }),
    prisma.salaryRate.findMany({
      where: { scheme: "HORA" },
      select: { userId: true, amount: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    getPayrollSettings(),
    prisma.payrollAdjustment.findMany({
      where: { weekStart: start },
      select: { userId: true, type: true, amount: true },
    }),
  ]);

  const adjustmentsByUser = new Map<string, { type: string; amount: number }[]>();
  for (const adj of adjustments) {
    const list = adjustmentsByUser.get(adj.userId) ?? [];
    list.push({ type: adj.type, amount: Number(adj.amount) });
    adjustmentsByUser.set(adj.userId, list);
  }

  const ratesByUser = new Map<string, RateRow[]>();
  for (const r of salaryRates) {
    const list = ratesByUser.get(r.userId) ?? [];
    list.push({ amount: Number(r.amount), effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo });
    ratesByUser.set(r.userId, list);
  }

  const hoursByUserDay = new Map<string, number[]>();
  for (const entry of entries) {
    if (!entry.clockOut) continue;
    const hours = hoursBetween(entry.clockIn, entry.clockOut);
    if (!(hours > 0)) continue;

    const dayKey = formatDateOnly(entry.clockIn);
    const dayIndex = dayKeys.indexOf(dayKey);
    if (dayIndex === -1) continue;

    const arr = hoursByUserDay.get(entry.userId) ?? new Array(7).fill(0);
    arr[dayIndex] += hours;
    hoursByUserDay.set(entry.userId, arr);
  }

  // Horas extra ya detectadas (o aprobadas) para la semana, sumadas
  // por si la persona trabajó en más de una sucursal. Si todavía no
  // hay registro (nadie ha corrido la detección en Tiempo Extra para
  // esta semana), se estima abajo en vivo.
  const overtimeByUser = new Map<string, number>();
  for (const record of overtimeRecords) {
    const current = overtimeByUser.get(record.userId) ?? 0;
    overtimeByUser.set(record.userId, current + Number(record.overtimeHours));
  }

  const employeeRows: PayrollWeekEmployee[] = [];
  let totalRegular = 0;
  let totalOvertime = 0;
  let totalPay = 0;
  let totalAdjustments = 0;
  let employeesWorked = 0;

  for (const employee of employees) {
    const hoursByDay = hoursByUserDay.get(employee.id) ?? new Array(7).fill(0);
    const totalHours = hoursByDay.reduce((sum, h) => sum + h, 0);
    const employeeAdjustments = adjustmentsByUser.get(employee.id) ?? [];

    // Se muestra si trabajó horas esta semana O si tiene un ajuste
    // manual (bono/deducción) aunque no haya checado — por ejemplo un
    // bono de fin de año o una deducción de un préstamo.
    if (totalHours <= 0 && employeeAdjustments.length === 0) continue;

    employeesWorked += 1;

    const overtimeHours =
      overtimeByUser.get(employee.id) ?? Math.max(0, totalHours - settings.weeklyHourThreshold);
    const regularHours = Math.max(0, totalHours - overtimeHours);

    const hourlyRate = resolveHourlyRate(
      ratesByUser.get(employee.id) ?? [],
      rateReferenceDate,
      employee.hourlyRate !== null ? Number(employee.hourlyRate) : null,
    );
    const missingRate = hourlyRate === null;

    const { doubleHours, tripleHours } = splitTiers(overtimeHours, settings);
    const overtimePay = computeAmount(doubleHours, tripleHours, hourlyRate, settings) ?? 0;
    const basePay = hourlyRate !== null ? regularHours * hourlyRate : 0;
    const estimatedPay = basePay + overtimePay;
    const adjustmentsTotal = netAdjustmentAmount(employeeAdjustments);
    const finalPay = estimatedPay + adjustmentsTotal;

    employeeRows.push({
      id: employee.id,
      name: employee.name,
      hourlyRate,
      missingRate,
      hoursByDay,
      daysWorked: hoursByDay.filter((h) => h > 0).length,
      regularHours,
      overtimeHours,
      totalHours,
      estimatedPay,
      adjustmentsTotal,
      finalPay,
    });

    totalRegular += regularHours;
    totalOvertime += overtimeHours;
    totalPay += estimatedPay;
    totalAdjustments += adjustmentsTotal;
  }

  employeeRows.sort((a, b) => b.totalHours - a.totalHours);

  return {
    employees: employeeRows,
    totals: {
      regularHours: totalRegular,
      overtimeHours: totalOvertime,
      totalHours: totalRegular + totalOvertime,
      employeesWorked,
      estimatedPay: totalPay,
      adjustmentsTotal: totalAdjustments,
      finalPay: totalPay + totalAdjustments,
    },
  };
}

/**
 * Calcula EN VIVO el expediente de un empleado: programado
 * (ScheduledShift) vs real (TimeClockEntry) día por día, más ajustes
 * manuales de la semana.
 */
async function computeLiveEmployeeDetail(
  userId: string,
  mondayStr: string,
): Promise<{ error: string } | Omit<PayrollEmployeeDetail, "period">> {
  const dayKeys = weekDayKeys(mondayStr);
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));
  const rateReferenceDate = new Date(end.getTime() - 1);

  const [employee, entries, shifts, overtimeRecords, salaryRates, settings, adjustments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, hourlyRate: true },
    }),
    prisma.timeClockEntry.findMany({
      where: { userId, clockIn: { gte: start, lt: end } },
      include: { branch: { select: { name: true } } },
      orderBy: { clockIn: "asc" },
    }),
    prisma.scheduledShift.findMany({
      where: { userId, type: "TURNO", date: { gte: start, lt: end } },
      include: { branch: { select: { name: true } } },
    }),
    prisma.overtimeRecord.findMany({
      where: { userId, weekStart: start },
      select: { overtimeHours: true },
    }),
    prisma.salaryRate.findMany({
      where: { userId, scheme: "HORA" },
      select: { amount: true, effectiveFrom: true, effectiveTo: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    getPayrollSettings(),
    prisma.payrollAdjustment.findMany({
      where: { userId, weekStart: start },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!employee) {
    return { error: "Empleado no encontrado" };
  }

  const entriesByDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = formatDateOnly(entry.clockIn);
    const list = entriesByDay.get(key) ?? [];
    list.push(entry);
    entriesByDay.set(key, list);
  }

  const shiftsByDay = new Map<string, (typeof shifts)[number]>();
  for (const shift of shifts) {
    shiftsByDay.set(formatDateOnly(shift.date), shift);
  }

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

    return {
      date: dateKey,
      scheduled: shift
        ? { branchName: shift.branch?.name ?? "Sin sucursal", startTime: shift.startTime ?? "—", endTime: shift.endTime ?? "—" }
        : null,
      actual: firstEntry
        ? {
            branchName: firstEntry.branch.name,
            clockIn: firstEntry.clockIn.toISOString(),
            clockOut: lastClosedEntry?.clockOut?.toISOString() ?? null,
            source: firstEntry.source,
          }
        : null,
      hoursWorked,
      incident,
      justified: false,
      justifiedNotes: null,
      justifiedByName: null,
    };
  });

  const totalHours = days.reduce((sum, d) => sum + d.hoursWorked, 0);
  const overtimeHours =
    overtimeRecords.length > 0
      ? overtimeRecords.reduce((sum, r) => sum + Number(r.overtimeHours), 0)
      : Math.max(0, totalHours - settings.weeklyHourThreshold);
  const regularHours = Math.max(0, totalHours - overtimeHours);

  const hourlyRate = resolveHourlyRate(
    salaryRates.map((r) => ({ amount: Number(r.amount), effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo })),
    rateReferenceDate,
    employee.hourlyRate !== null ? Number(employee.hourlyRate) : null,
  );

  const { doubleHours, tripleHours } = splitTiers(overtimeHours, settings);
  const overtimePay = computeAmount(doubleHours, tripleHours, hourlyRate, settings) ?? 0;
  const basePay = hourlyRate !== null ? regularHours * hourlyRate : 0;
  const totalPay = basePay + overtimePay;

  const adjustmentRows: PayrollAdjustmentRow[] = adjustments.map((adj) => ({
    id: adj.id,
    type: adj.type,
    concept: adj.concept,
    amount: Number(adj.amount),
    notes: adj.notes,
    createdByName: adj.createdBy.name,
    createdAt: adj.createdAt.toISOString(),
  }));
  const adjustmentsTotal = netAdjustmentAmount(
    adjustmentRows.map((a) => ({ type: a.type, amount: a.amount })),
  );

  const justifications = await loadJustificationsMap(userId, mondayStr);

  return {
    employee: { id: employee.id, name: employee.name, hourlyRate },
    weekStart: mondayStr,
    weekEnd: addDaysToDateOnly(mondayStr, 6),
    days: applyJustifications(days, justifications),
    regularHours,
    overtimeHours,
    totalHours,
    basePay,
    overtimePay,
    totalPay,
    adjustments: adjustmentRows,
    adjustmentsTotal,
    finalPay: totalPay + adjustmentsTotal,
  };
}

/**
 * Justificaciones vigentes de un empleado en una semana. Se cargan
 * siempre en vivo (aunque la semana ya esté congelada en
 * PayrollEntry) porque justificar una incidencia es documentación,
 * no un número de pago — se puede justificar antes o después de que
 * la nómina se apruebe o se pague.
 */
async function loadJustificationsMap(userId: string, mondayStr: string) {
  const start = parseDateOnly(mondayStr);
  const end = parseDateOnly(addDaysToDateOnly(mondayStr, 7));

  const justifications = await prisma.payrollIncidentJustification.findMany({
    where: { userId, date: { gte: start, lt: end } },
    include: { justifiedBy: { select: { name: true } } },
  });

  const map = new Map<string, { notes: string | null; justifiedByName: string }>();
  for (const j of justifications) {
    map.set(formatDateOnly(j.date), { notes: j.notes, justifiedByName: j.justifiedBy.name });
  }
  return map;
}

/** Sobrepone las justificaciones vigentes sobre un arreglo de días ya construido. */
function applyJustifications(
  days: PayrollDayDetail[],
  justifications: Map<string, { notes: string | null; justifiedByName: string }>,
): PayrollDayDetail[] {
  return days.map((day) => {
    const justification = justifications.get(day.date) ?? null;
    return {
      ...day,
      justified: justification !== null,
      justifiedNotes: justification?.notes ?? null,
      justifiedByName: justification?.justifiedByName ?? null,
    };
  });
}

async function loadPeriodWithEntries(mondayStr: string) {
  return prisma.payrollPeriod.findUnique({
    where: { weekStart: parseDateOnly(mondayStr) },
    include: {
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      paidBy: { select: { name: true } },
      entries: { include: { user: { select: { id: true, name: true } } } },
    },
  });
}

function periodInfoFrom(
  period: Awaited<ReturnType<typeof loadPeriodWithEntries>> | null,
): PayrollPeriodInfo {
  if (!period) {
    return {
      status: "BORRADOR",
      submittedByName: null,
      submittedAt: null,
      approvedByName: null,
      approvedAt: null,
      paidByName: null,
      paidAt: null,
      rejectedNotes: null,
    };
  }

  return {
    status: period.status,
    submittedByName: period.submittedBy?.name ?? null,
    submittedAt: period.submittedAt?.toISOString() ?? null,
    approvedByName: period.approvedBy?.name ?? null,
    approvedAt: period.approvedAt?.toISOString() ?? null,
    paidByName: period.paidBy?.name ?? null,
    paidAt: period.paidAt?.toISOString() ?? null,
    rejectedNotes: period.rejectedNotes,
  };
}

/**
 * Vista semanal principal de Nómina: una fila por empleado, horas
 * reales trabajadas por día (checador), y los totales de la semana.
 * Si la semana ya fue enviada a revisión, se lee el snapshot
 * congelado en vez de recalcular.
 */
export async function getPayrollWeekTable(
  weekStart: string,
): Promise<{ error: string } | { success: true; data: PayrollWeekTable }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const weekEnd = addDaysToDateOnly(mondayStr, 6);
  const period = await loadPeriodWithEntries(mondayStr);

  if (period && period.status !== "BORRADOR") {
    const employees: PayrollWeekEmployee[] = period.entries
      .map((entry) => {
        const hoursByDay = entry.hoursByDay as number[];
        return {
          id: entry.userId,
          name: entry.user.name,
          hourlyRate: entry.hourlyRate !== null ? Number(entry.hourlyRate) : null,
          missingRate: entry.hourlyRate === null,
          hoursByDay,
          daysWorked: hoursByDay.filter((h) => h > 0).length,
          regularHours: Number(entry.regularHours),
          overtimeHours: Number(entry.overtimeHours),
          totalHours: Number(entry.totalHours),
          estimatedPay: Number(entry.basePay) + Number(entry.overtimePay),
          adjustmentsTotal: Number(entry.adjustmentsTotal),
          finalPay: Number(entry.totalPay),
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    const totals = employees.reduce(
      (acc, e) => {
        acc.regularHours += e.regularHours;
        acc.overtimeHours += e.overtimeHours;
        acc.estimatedPay += e.estimatedPay;
        acc.adjustmentsTotal += e.adjustmentsTotal;
        acc.finalPay += e.finalPay;
        return acc;
      },
      { regularHours: 0, overtimeHours: 0, totalHours: 0, employeesWorked: employees.length, estimatedPay: 0, adjustmentsTotal: 0, finalPay: 0 },
    );
    totals.totalHours = totals.regularHours + totals.overtimeHours;

    return {
      success: true,
      data: { weekStart: mondayStr, weekEnd, employees, totals, period: periodInfoFrom(period) },
    };
  }

  const live = await computeLiveWeekEmployees(mondayStr);

  return {
    success: true,
    data: {
      weekStart: mondayStr,
      weekEnd,
      employees: live.employees,
      totals: live.totals,
      period: periodInfoFrom(period),
    },
  };
}

/**
 * Expediente semanal de un empleado. Igual que la tabla, si la semana
 * ya fue enviada a revisión se lee el snapshot congelado.
 */
export async function getEmployeePayrollDetail(
  userId: string,
  weekStart: string,
): Promise<{ error: string } | { success: true; data: PayrollEmployeeDetail }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const weekEnd = addDaysToDateOnly(mondayStr, 6);
  const period = await loadPeriodWithEntries(mondayStr);

  if (period && period.status !== "BORRADOR") {
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!employee) return { error: "Empleado no encontrado" };

    const entry = period.entries.find((e) => e.userId === userId);
    const periodInfo = periodInfoFrom(period);
    const justifications = await loadJustificationsMap(userId, mondayStr);

    if (!entry) {
      // No trabajó ni tuvo ajustes esta semana al momento de congelarla.
      const emptyDays: PayrollDayDetail[] = weekDayKeys(mondayStr).map((date) => ({
        date,
        scheduled: null,
        actual: null,
        hoursWorked: 0,
        incident: null,
        justified: false,
        justifiedNotes: null,
        justifiedByName: null,
      }));

      return {
        success: true,
        data: {
          employee: { id: employee.id, name: employee.name, hourlyRate: null },
          weekStart: mondayStr,
          weekEnd,
          days: applyJustifications(emptyDays, justifications),
          regularHours: 0,
          overtimeHours: 0,
          totalHours: 0,
          basePay: 0,
          overtimePay: 0,
          totalPay: 0,
          adjustments: [],
          adjustmentsTotal: 0,
          finalPay: 0,
          period: periodInfo,
        },
      };
    }

    return {
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          hourlyRate: entry.hourlyRate !== null ? Number(entry.hourlyRate) : null,
        },
        weekStart: mondayStr,
        weekEnd,
        days: applyJustifications(entry.daysSnapshot as PayrollDayDetail[], justifications),
        regularHours: Number(entry.regularHours),
        overtimeHours: Number(entry.overtimeHours),
        totalHours: Number(entry.totalHours),
        basePay: Number(entry.basePay),
        overtimePay: Number(entry.overtimePay),
        totalPay: Number(entry.basePay) + Number(entry.overtimePay),
        adjustments: entry.adjustmentsSnapshot as PayrollAdjustmentRow[],
        adjustmentsTotal: Number(entry.adjustmentsTotal),
        finalPay: Number(entry.totalPay),
        period: periodInfo,
      },
    };
  }

  const live = await computeLiveEmployeeDetail(userId, mondayStr);
  if ("error" in live) return live;

  return { success: true, data: { ...live, period: periodInfoFrom(period) } };
}

/**
 * Crea un bono o deducción manual para un empleado en una semana
 * específica (propinas repartidas, préstamos, faltas de caja,
 * premios, etc). Solo admins, y solo mientras la semana sigue en
 * borrador (si ya se envió a revisión, hay que reabrirla primero).
 */
export async function createPayrollAdjustmentAction(input: {
  userId: string;
  weekStart: string;
  type: "BONO" | "DEDUCCION";
  concept: string;
  amount: number;
  notes?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const concept = input.concept.trim();
  if (!concept) return { error: "Escribe un concepto" };
  if (!(input.amount > 0)) return { error: "El monto debe ser mayor a cero" };

  const mondayStr = mondayOfWeek(input.weekStart);
  const start = parseDateOnly(mondayStr);

  const period = await prisma.payrollPeriod.findUnique({
    where: { weekStart: start },
    select: { status: true },
  });
  if (period && period.status !== "BORRADOR") {
    return { error: "Esta semana ya fue enviada a revisión. Reábrela para modificar ajustes." };
  }

  await prisma.payrollAdjustment.create({
    data: {
      userId: input.userId,
      weekStart: start,
      type: input.type,
      concept,
      amount: input.amount,
      notes: input.notes?.trim() || undefined,
      createdById: admin.id,
    },
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/** Elimina un bono/deducción manual. Solo admins, solo si la semana sigue en borrador. */
export async function deletePayrollAdjustmentAction(id: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const adjustment = await prisma.payrollAdjustment.findUnique({
    where: { id },
    select: { weekStart: true },
  });
  if (!adjustment) return { error: "No encontrado" };

  const period = await prisma.payrollPeriod.findUnique({
    where: { weekStart: adjustment.weekStart },
    select: { status: true },
  });
  if (period && period.status !== "BORRADOR") {
    return { error: "Esta semana ya fue enviada a revisión. Reábrela para modificar ajustes." };
  }

  await prisma.payrollAdjustment.delete({ where: { id } });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/**
 * Envía la semana a revisión: congela en PayrollEntry los números
 * que hasta ahora se calculaban en vivo (tabla + expediente de cada
 * empleado con horas o ajustes). De aquí en adelante, aunque cambien
 * checadas o turnos de esa semana, la nómina ya decidida no se mueve
 * sola — hay que reabrirla explícitamente.
 */
export async function submitPayrollPeriodAction(weekStart: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const start = parseDateOnly(mondayStr);

  const existing = await prisma.payrollPeriod.findUnique({ where: { weekStart: start } });
  if (existing && existing.status !== "BORRADOR") {
    return { error: "Esta semana ya fue enviada a revisión" };
  }

  const live = await computeLiveWeekEmployees(mondayStr);
  if (live.employees.length === 0) {
    return { error: "No hay horas ni ajustes registrados en esta semana" };
  }

  const details = await Promise.all(
    live.employees.map((e) => computeLiveEmployeeDetail(e.id, mondayStr)),
  );

  await prisma.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.upsert({
      where: { weekStart: start },
      create: {
        weekStart: start,
        weekEnd: parseDateOnly(addDaysToDateOnly(mondayStr, 6)),
        status: "REVISION",
        submittedById: admin.id,
        submittedAt: new Date(),
      },
      update: {
        status: "REVISION",
        submittedById: admin.id,
        submittedAt: new Date(),
        rejectedNotes: null,
      },
    });

    await tx.payrollEntry.deleteMany({ where: { periodId: period.id } });

    for (const detail of details) {
      if ("error" in detail) continue;
      const hoursByDay =
        live.employees.find((e) => e.id === detail.employee.id)?.hoursByDay ?? new Array(7).fill(0);

      await tx.payrollEntry.create({
        data: {
          periodId: period.id,
          userId: detail.employee.id,
          hourlyRate: detail.employee.hourlyRate,
          regularHours: detail.regularHours,
          overtimeHours: detail.overtimeHours,
          totalHours: detail.totalHours,
          basePay: detail.basePay,
          overtimePay: detail.overtimePay,
          adjustmentsTotal: detail.adjustmentsTotal,
          totalPay: detail.finalPay,
          hoursByDay,
          daysSnapshot: detail.days,
          adjustmentsSnapshot: detail.adjustments,
        },
      });
    }
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/** REVISION -> APROBADA. Solo admins. */
export async function approvePayrollPeriodAction(weekStart: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const period = await prisma.payrollPeriod.findUnique({ where: { weekStart: parseDateOnly(mondayStr) } });
  if (!period || period.status !== "REVISION") {
    return { error: "Esta semana no está en revisión" };
  }

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: "APROBADA", approvedById: admin.id, approvedAt: new Date() },
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/** APROBADA -> PAGADA. Solo admins. Cierra la semana por completo. */
export async function markPayrollPeriodPaidAction(weekStart: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const period = await prisma.payrollPeriod.findUnique({ where: { weekStart: parseDateOnly(mondayStr) } });
  if (!period || period.status !== "APROBADA") {
    return { error: "Esta semana no está aprobada" };
  }

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: "PAGADA", paidById: admin.id, paidAt: new Date() },
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/**
 * Reabre una semana en REVISION o APROBADA de vuelta a BORRADOR:
 * borra el snapshot congelado y la tabla vuelve a calcularse en
 * vivo. Una semana PAGADA ya no se puede reabrir.
 */
export async function reopenPayrollPeriodAction(weekStart: string, notes?: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const mondayStr = mondayOfWeek(weekStart);
  const period = await prisma.payrollPeriod.findUnique({ where: { weekStart: parseDateOnly(mondayStr) } });
  if (!period) return { error: "No hay nada que reabrir" };
  if (period.status === "PAGADA") return { error: "Ya está pagada, no se puede reabrir" };
  if (period.status === "BORRADOR") return { error: "Ya está en borrador" };

  await prisma.$transaction([
    prisma.payrollEntry.deleteMany({ where: { periodId: period.id } }),
    prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        status: "BORRADOR",
        submittedById: null,
        submittedAt: null,
        approvedById: null,
        approvedAt: null,
        rejectedNotes: notes?.trim() || null,
      },
    }),
  ]);

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/**
 * Justifica la incidencia de un día específico (llegada tarde, turno
 * no trabajado, etc.) con una nota. No cambia horas ni pago — es
 * documentación para que quede claro por qué pasó y no cuente como
 * una alerta real en los reportes. Funciona incluso si la semana ya
 * está congelada/pagada.
 */
export async function justifyIncidentAction(input: {
  userId: string;
  date: string;
  notes?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.payrollIncidentJustification.upsert({
    where: { userId_date: { userId: input.userId, date: parseDateOnly(input.date) } },
    update: { notes: input.notes?.trim() || null, justifiedById: admin.id, justifiedAt: new Date() },
    create: {
      userId: input.userId,
      date: parseDateOnly(input.date),
      notes: input.notes?.trim() || null,
      justifiedById: admin.id,
    },
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}

/** Quita la justificación de un día (vuelve a mostrarse como incidencia sin justificar). */
export async function unjustifyIncidentAction(userId: string, date: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.payrollIncidentJustification.deleteMany({
    where: { userId, date: parseDateOnly(date) },
  });

  revalidatePath("/timeclock/payroll");
  return { success: true };
}
