"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateOnly, addDaysToDateOnly, formatDateOnly } from "@/lib/dateOnly";

/**
 * Analítica de nómina para dirección: costo real de mano de obra,
 * horas trabajadas y su relación con las ventas del Punto de Venta,
 * abierto por sucursal, por persona y por día.
 *
 * Notas importantes sobre los datos disponibles:
 * - El costo se calcula al vuelo como `horas × User.hourlyRate`. No
 *   existe un campo de costo guardado en el turno, ni historial de
 *   tarifas: si cambias la tarifa de alguien, los periodos pasados se
 *   recalculan con la tarifa nueva.
 * - Quien no tiene `hourlyRate` capturado aporta horas pero no costo.
 *   Por eso se reporta aparte `hoursWithoutRate` y `peopleWithoutRate`:
 *   sin eso, el costo total se vería artificialmente bajo.
 * - No existen en el sistema horas extra, bonos, deducciones ni
 *   ausencias como tal. Las ausencias se infieren comparando turnos
 *   programados contra checadas reales.
 */

const MEXICAN_WEEKLY_HOUR_LIMIT = 48;

export type PayrollAnalytics = {
  from: string;
  to: string;
  days: number;

  /** false = falta correr `prisma db push`; el tiempo extra no se puede leer. */
  overtimeAvailable: boolean;

  totals: {
    /** Costo base + tiempo extra aprobado. */
    cost: number;
    baseCost: number;
    overtimeCost: number;
    overtimeHours: number;
    pendingOvertimeCost: number;
    pendingOvertimeCount: number;
    hours: number;
    hoursWithoutRate: number;
    peopleWithoutRate: number;
    people: number;
    shifts: number;
    openShifts: number;
    averageHourlyCost: number;
    sales: number;
    laborShare: number | null;
    scheduledHours: number;
    missedShifts: number;
  };

  branches: Array<{
    id: string;
    name: string;
    cost: number;
    baseCost: number;
    overtimeCost: number;
    hours: number;
    people: number;
    shifts: number;
    sales: number;
    laborShare: number | null;
    scheduledHours: number;
    missedShifts: number;
  }>;

  people: Array<{
    id: string;
    name: string;
    hourlyRate: number | null;
    cost: number;
    baseCost: number;
    overtimeCost: number;
    overtimeHours: number;
    hours: number;
    shifts: number;
    branches: string[];
    averageShiftHours: number;
    weeklyHours: number;
    overLegalLimit: boolean;
  }>;

  daily: Array<{
    date: string;
    label: string;
    cost: number;
    hours: number;
    sales: number;
  }>;
};

function hoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

type OvertimeSlice = {
  userId: string;
  branchId: string;
  overtimeHours: unknown;
  amount: unknown;
  status: string;
};

/**
 * Lee los registros de tiempo extra sin tumbar la página si la tabla
 * todavía no existe en la base (falta `prisma db push`) o si el cliente
 * de Prisma no se ha regenerado. Devuelve `available: false` para que la
 * interfaz lo diga con claridad en vez de mostrar ceros silenciosos.
 */
async function fetchOvertimeSafely(
  start: Date,
  end: Date,
): Promise<{ available: boolean; records: OvertimeSlice[] }> {
  const model = (prisma as { overtimeRecord?: { findMany: (args: unknown) => Promise<OvertimeSlice[]> } })
    .overtimeRecord;

  if (!model) {
    return { available: false, records: [] };
  }

  try {
    const records = await model.findMany({
      where: { weekStart: { gte: start, lt: end } },
      select: {
        userId: true,
        branchId: true,
        overtimeHours: true,
        amount: true,
        status: true,
      },
    });

    return { available: true, records };
  } catch (error) {
    console.error("Tiempo extra no disponible (¿falta prisma db push?):", error);
    return { available: false, records: [] };
  }
}

/** "HH:MM" -> horas decimales. Cruza medianoche si el fin es menor al inicio. */
function scheduledHoursOf(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const minutes = end >= start ? end - start : end + 24 * 60 - start;

  return minutes / 60;
}

export async function getPayrollAnalytics(
  from: string,
  to: string,
): Promise<{ error: string } | { success: true; data: PayrollAnalytics }> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { error: "No autorizado" };
  }

  if (currentUser.role !== "ADMIN") {
    return { error: "Solo un administrador puede ver la nómina" };
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(addDaysToDateOnly(to, 1));

  if (!(start < end)) {
    return { error: "El rango de fechas no es válido." };
  }

  const days = Math.round(hoursBetween(start, end) / 24);

  const [entries, openEntries, scheduled, sales, branchList, overtime] = await Promise.all([
    prisma.timeClockEntry.findMany({
      where: {
        clockIn: { gte: start, lt: end },
        clockOut: { not: null },
      },
      select: {
        userId: true,
        branchId: true,
        clockIn: true,
        clockOut: true,
        user: { select: { id: true, name: true, hourlyRate: true } },
        branch: { select: { id: true, name: true } },
      },
    }),

    prisma.timeClockEntry.count({
      where: { clockIn: { gte: start, lt: end }, clockOut: null },
    }),

    // DESCANSO (día libre) no tiene sucursal ni horas: no cuenta como
    // turno programado para comparar contra lo trabajado.
    prisma.scheduledShift.findMany({
      where: { date: { gte: start, lt: end }, type: "TURNO" },
      select: {
        userId: true,
        branchId: true,
        date: true,
        startTime: true,
        endTime: true,
        branch: { select: { id: true, name: true } },
      },
    }),

    prisma.posSale.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: "COMPLETADA",
      },
      select: { total: true, createdAt: true, branchId: true },
    }),

    prisma.branch.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    /*
     * El tiempo extra se guarda por semana completa (lunes a domingo).
     * Solo se cuentan las semanas que INICIAN dentro del rango: contar
     * una semana que empezó antes inflaría el periodo con horas que no
     * le corresponden.
     *
     * Va tolerante a fallos a propósito: si la tabla todavía no existe
     * (falta correr `prisma db push`), el resto del tablero de nómina
     * debe seguir funcionando en vez de tirar la página entera.
     */
    fetchOvertimeSafely(start, end),
  ]);

  const branchNames = new Map(branchList.map((b) => [b.id, b.name]));

  type BranchAcc = {
    id: string;
    name: string;
    cost: number;
    overtimeCost: number;
    hours: number;
    shifts: number;
    people: Set<string>;
    sales: number;
    scheduledHours: number;
    missedShifts: number;
  };

  type PersonAcc = {
    id: string;
    name: string;
    hourlyRate: number | null;
    cost: number;
    overtimeCost: number;
    overtimeHours: number;
    hours: number;
    shifts: number;
    branches: Set<string>;
  };

  const branchAcc = new Map<string, BranchAcc>();
  const personAcc = new Map<string, PersonAcc>();
  const dailyAcc = new Map<string, { cost: number; hours: number; sales: number }>();

  function branchOf(id: string, fallbackName?: string): BranchAcc {
    const existing = branchAcc.get(id);
    if (existing) return existing;

    const created: BranchAcc = {
      id,
      name: branchNames.get(id) ?? fallbackName ?? "Sucursal",
      cost: 0,
      overtimeCost: 0,
      hours: 0,
      shifts: 0,
      people: new Set(),
      sales: 0,
      scheduledHours: 0,
      missedShifts: 0,
    };
    branchAcc.set(id, created);
    return created;
  }

  function dayOf(date: Date) {
    const key = formatDateOnly(date);
    const existing = dailyAcc.get(key);
    if (existing) return existing;

    const created = { cost: 0, hours: 0, sales: 0 };
    dailyAcc.set(key, created);
    return created;
  }

  let totalCost = 0;
  let totalHours = 0;
  let hoursWithoutRate = 0;
  const peopleWithoutRate = new Set<string>();

  for (const entry of entries) {
    if (!entry.clockOut) continue;

    const hours = hoursBetween(entry.clockIn, entry.clockOut);
    if (!(hours > 0)) continue;

    const rate =
      entry.user.hourlyRate !== null ? Number(entry.user.hourlyRate) : null;
    const cost = rate !== null ? hours * rate : 0;

    if (rate === null) {
      hoursWithoutRate += hours;
      peopleWithoutRate.add(entry.userId);
    }

    totalHours += hours;
    totalCost += cost;

    const branch = branchOf(entry.branchId, entry.branch.name);
    branch.hours += hours;
    branch.cost += cost;
    branch.shifts += 1;
    branch.people.add(entry.userId);

    const person =
      personAcc.get(entry.userId) ??
      {
        id: entry.userId,
        name: entry.user.name,
        hourlyRate: rate,
        cost: 0,
        overtimeCost: 0,
        overtimeHours: 0,
        hours: 0,
        shifts: 0,
        branches: new Set<string>(),
      };

    person.hours += hours;
    person.cost += cost;
    person.shifts += 1;
    person.branches.add(entry.branch.name);
    personAcc.set(entry.userId, person);

    const day = dayOf(entry.clockIn);
    day.hours += hours;
    day.cost += cost;
  }

  /*
   * Turnos programados: horas planeadas y ausencias. No hay relación
   * directa entre ScheduledShift y TimeClockEntry, así que una
   * ausencia se infiere como "había turno programado ese día para esa
   * persona en esa sucursal y no existe ninguna checada que empate".
   */
  const workedKeys = new Set(
    entries.map(
      (e) => `${e.userId}-${e.branchId}-${formatDateOnly(e.clockIn)}`,
    ),
  );

  let totalScheduledHours = 0;
  let totalMissedShifts = 0;

  for (const shift of scheduled) {
    // Defensivo: la consulta ya filtra type TURNO, pero branchId y las
    // horas son opcionales a nivel de schema (por DESCANSO).
    if (!shift.branchId || !shift.startTime || !shift.endTime || !shift.branch) continue;

    const hours = scheduledHoursOf(shift.startTime, shift.endTime);
    totalScheduledHours += hours;

    const branch = branchOf(shift.branchId, shift.branch.name);
    branch.scheduledHours += hours;

    const key = `${shift.userId}-${shift.branchId}-${formatDateOnly(shift.date)}`;
    if (!workedKeys.has(key)) {
      totalMissedShifts += 1;
      branch.missedShifts += 1;
    }
  }

  /*
   * Tiempo extra: solo el APROBADO suma al costo. El pendiente se
   * reporta aparte para que dirección sepa cuánto dinero está por
   * autorizarse, sin inflar el costo del periodo.
   */
  let overtimeCost = 0;
  let overtimeHours = 0;
  let pendingOvertimeCost = 0;
  let pendingOvertimeCount = 0;

  for (const record of overtime.records) {
    const amount = record.amount !== null ? Number(record.amount) : 0;

    if (record.status === "PENDIENTE") {
      pendingOvertimeCost += amount;
      pendingOvertimeCount += 1;
      continue;
    }

    if (record.status !== "APROBADO") continue;

    const recordHours = Number(record.overtimeHours);

    overtimeCost += amount;
    overtimeHours += recordHours;
    totalCost += amount;

    const branch = branchAcc.get(record.branchId);
    if (branch) {
      branch.cost += amount;
      branch.overtimeCost += amount;
    }

    const person = personAcc.get(record.userId);
    if (person) {
      person.cost += amount;
      person.overtimeCost += amount;
      person.overtimeHours += recordHours;
    }
  }

  let totalSales = 0;

  for (const sale of sales) {
    totalSales += sale.total;

    const branch = branchOf(sale.branchId);
    branch.sales += sale.total;

    dayOf(sale.createdAt).sales += sale.total;
  }

  const weeks = Math.max(days / 7, 1);

  const people = Array.from(personAcc.values())
    .map((p) => {
      const weeklyHours = p.hours / weeks;

      return {
        id: p.id,
        name: p.name,
        hourlyRate: p.hourlyRate,
        cost: p.cost,
        baseCost: p.cost - p.overtimeCost,
        overtimeCost: p.overtimeCost,
        overtimeHours: p.overtimeHours,
        hours: p.hours,
        shifts: p.shifts,
        branches: Array.from(p.branches).sort((a, b) => a.localeCompare(b, "es")),
        averageShiftHours: p.shifts > 0 ? p.hours / p.shifts : 0,
        weeklyHours,
        overLegalLimit: weeklyHours > MEXICAN_WEEKLY_HOUR_LIMIT,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const branches = Array.from(branchAcc.values())
    .map((b) => ({
      id: b.id,
      name: b.name,
      cost: b.cost,
      baseCost: b.cost - b.overtimeCost,
      overtimeCost: b.overtimeCost,
      hours: b.hours,
      people: b.people.size,
      shifts: b.shifts,
      sales: b.sales,
      laborShare: b.sales > 0 ? (b.cost / b.sales) * 100 : null,
      scheduledHours: b.scheduledHours,
      missedShifts: b.missedShifts,
    }))
    .sort((a, b) => b.cost - a.cost);

  const daily = Array.from(dailyAcc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
      }),
      cost: Math.round(value.cost),
      hours: Math.round(value.hours * 10) / 10,
      sales: Math.round(value.sales),
    }));

  return {
    success: true,
    data: {
      from,
      to,
      days,
      overtimeAvailable: overtime.available,
      totals: {
        cost: totalCost,
        baseCost: totalCost - overtimeCost,
        overtimeCost,
        overtimeHours,
        pendingOvertimeCost,
        pendingOvertimeCount,
        hours: totalHours,
        hoursWithoutRate,
        peopleWithoutRate: peopleWithoutRate.size,
        people: personAcc.size,
        shifts: entries.length,
        openShifts: openEntries,
        averageHourlyCost:
          totalHours - hoursWithoutRate > 0
            ? totalCost / (totalHours - hoursWithoutRate)
            : 0,
        sales: totalSales,
        laborShare: totalSales > 0 ? (totalCost / totalSales) * 100 : null,
        scheduledHours: totalScheduledHours,
        missedShifts: totalMissedShifts,
      },
      branches,
      people,
      daily,
    },
  };
}
