"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  addDaysToDateOnly,
  mondayOfWeek,
  parseDateOnly,
  todayDateOnly,
} from "@/lib/dateOnly";
import { distanceMeters, hasGeofence } from "@/lib/geo";

const BRANCH_LOCATION_SELECT = {
  id: true,
  name: true,
  geofence: {
    select: { latitude: true, longitude: true, radius: true },
  },
} as const;

type Coords = { latitude: number; longitude: number };

/**
 * Si la sucursal tiene geozona asignada, exige coordenadas del
 * empleado y verifica que estén dentro del radio permitido.
 * Devuelve `null` si todo está bien (o si la sucursal no tiene
 * geozona), o un mensaje de error listo para mostrar.
 */
function checkGeofence(
  branch: {
    geofence: { latitude: number; longitude: number; radius: number } | null;
  },
  coords: Coords | null | undefined
): { error: string } | { distance: number } | null {
  if (!hasGeofence(branch)) return null;

  if (!coords) {
    return {
      error:
        "Esta sucursal requiere confirmar tu ubicación. Activa el GPS y vuelve a intentar.",
    };
  }

  const distance = distanceMeters(
    branch.geofence.latitude,
    branch.geofence.longitude,
    coords.latitude,
    coords.longitude
  );

  if (distance > branch.geofence.radius) {
    return {
      error: `Estás a ${Math.round(distance)} m de la sucursal (máximo ${branch.geofence.radius} m). Debes estar en la sucursal para checar.`,
    };
  }

  return { distance };
}

export async function getMyOpenShift() {
  const user = await getCurrentUser();
  if (!user) return null;

  return prisma.timeClockEntry.findFirst({
    where: { userId: user.id, clockOut: null },
    include: { branch: { select: BRANCH_LOCATION_SELECT } },
  });
}

export async function getMyBranches() {
  const user = await getCurrentUser();
  if (!user) return [];

  const branches = await prisma.userBranch.findMany({
    where: { userId: user.id },
    include: { branch: { select: BRANCH_LOCATION_SELECT } },
  });

  return branches.map((b) => b.branch);
}

export async function clockInAction(branchId: string, coords?: Coords) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado" };
  }

  const openShift = await prisma.timeClockEntry.findFirst({
    where: { userId: user.id, clockOut: null },
  });

  if (openShift) {
    return { error: "Ya tienes un turno abierto. Debes cerrarlo antes de checar entrada de nuevo." };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: BRANCH_LOCATION_SELECT,
  });

  if (!branch) {
    return { error: "Sucursal no encontrada" };
  }

  const geofenceResult = checkGeofence(branch, coords);
  if (geofenceResult && "error" in geofenceResult) {
    return { error: geofenceResult.error };
  }

  const entry = await prisma.timeClockEntry.create({
    data: {
      userId: user.id,
      branchId,
      clockIn: new Date(),
    },
  });

  revalidatePath("/timeclock");

  return { success: true, entry };
}

export async function clockOutAction(
  entryId: string,
  clockInAdjusted: string,
  clockOutAdjusted: string,
  coords?: Coords,
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado" };
  }

  const entry = await prisma.timeClockEntry.findUnique({
    where: { id: entryId },
    include: { branch: { select: BRANCH_LOCATION_SELECT } },
  });

  if (!entry || entry.userId !== user.id) {
    return { error: "Turno no encontrado" };
  }

  if (entry.clockOut) {
    return { error: "Este turno ya está cerrado" };
  }

  const geofenceResult = checkGeofence(entry.branch, coords);
  if (geofenceResult && "error" in geofenceResult) {
    return { error: geofenceResult.error };
  }

  const clockIn = new Date(clockInAdjusted);
  const clockOut = new Date(clockOutAdjusted);

  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) {
    return { error: "Las horas no son válidas" };
  }

  if (clockOut <= clockIn) {
    return { error: "La hora de salida debe ser después de la entrada" };
  }

  await prisma.timeClockEntry.update({
    where: { id: entryId },
    data: {
      clockIn,
      clockOut,
      confirmedByEmployee: true,
    },
  });

  revalidatePath("/timeclock");

  return { success: true };
}

/**
 * Se llama desde el checador mientras el empleado tiene un turno
 * abierto y el navegador detecta que salió del radio permitido de
 * su sucursal. Registra la alerta para que un administrador la vea
 * (el propio checador ya le muestra el aviso al empleado).
 */
export async function reportGeofenceAlert(
  entryId: string,
  coords: Coords,
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado" };
  }

  const entry = await prisma.timeClockEntry.findUnique({
    where: { id: entryId },
    include: { branch: { select: BRANCH_LOCATION_SELECT } },
  });

  if (!entry || entry.userId !== user.id || entry.clockOut) {
    return { error: "Turno no encontrado" };
  }

  if (!hasGeofence(entry.branch)) {
    return { success: true };
  }

  const distance = distanceMeters(
    entry.branch.geofence.latitude,
    entry.branch.geofence.longitude,
    coords.latitude,
    coords.longitude
  );

  // Evita registrar alertas repetidas cada pocos segundos mientras
  // el empleado sigue fuera del área: solo una por cada 5 minutos.
  const recent = await prisma.geofenceAlert.findFirst({
    where: {
      timeClockId: entry.id,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });

  if (recent) {
    return { success: true, throttled: true };
  }

  await prisma.geofenceAlert.create({
    data: {
      userId: user.id,
      branchId: entry.branchId,
      timeClockId: entry.id,
      distance: Math.round(distance),
    },
  });

  revalidatePath("/administration/personnel/timeclock");

  return { success: true };
}

export async function getRecentGeofenceAlerts(limit = 20) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return [];

  return prisma.geofenceAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}

export async function getOpenShiftsForAdmin() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return [];

  return prisma.timeClockEntry.findMany({
    where: { clockOut: null },
    include: {
      user: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { clockIn: "asc" },
  });
}

export async function closeShiftManuallyAction(
  entryId: string,
  clockOutAdjusted: string,
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const entry = await prisma.timeClockEntry.findUnique({ where: { id: entryId } });

  if (!entry) {
    return { error: "Turno no encontrado" };
  }

  const clockOut = new Date(clockOutAdjusted);

  if (Number.isNaN(clockOut.getTime()) || clockOut <= entry.clockIn) {
    return { error: "La hora de salida no es válida" };
  }

  await prisma.timeClockEntry.update({
    where: { id: entryId },
    data: {
      clockOut,
      confirmedByEmployee: false,
      closedManuallyById: admin.id,
    },
  });

  revalidatePath("/administration/personnel/timeclock");

  return { success: true };
}
export async function getWeeklyPayrollReport(weekStart: string, branchId?: string) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { error: "No autorizado" };
  }

   if (currentUser.role !== "ADMIN") {
    return { error: "Solo un administrador puede ver la nómina" };
  }

  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDaysToDateOnly(weekStart, 7));


  const entries = await prisma.timeClockEntry.findMany({
    where: {
      clockIn: { gte: start, lt: end },
      clockOut: { not: null },
           branchId: branchId ?? undefined,

    },
    include: {
      user: { select: { id: true, name: true, hourlyRate: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { clockIn: "asc" },
  });

  type Summary = {
    userId: string;
    name: string;
    hourlyRate: number | null;
    branchName: string;
    totalHours: number;
    totalPay: number | null;
    shifts: number;
  };

  const byUser = new Map<string, Summary>();

  for (const entry of entries) {
    if (!entry.clockOut) continue;

    const hours =
      (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);

    const key = `${entry.userId}-${entry.branchId}`;
    const rate = entry.user.hourlyRate !== null ? Number(entry.user.hourlyRate) : null;

    const existing = byUser.get(key) ?? {
      userId: entry.userId,
      name: entry.user.name,
      hourlyRate: rate,
      branchName: entry.branch.name,
      totalHours: 0,
      totalPay: rate !== null ? 0 : null,
      shifts: 0,
    };

    existing.totalHours += hours;
    if (rate !== null && existing.totalPay !== null) {
      existing.totalPay += hours * rate;
    }
    existing.shifts += 1;

    byUser.set(key, existing);
  }

  const summary = Array.from(byUser.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const grandTotal = summary.reduce((sum, s) => sum + (s.totalPay ?? 0), 0);

  return { success: true, weekStart: start, weekEnd: end, summary, grandTotal };
}

/**
 * Resumen del propio trabajador para el checador: horas trabajadas
 * hoy, horas en lo que va de la semana, y dinero ganado según su
 * pago por hora (si lo tiene configurado). Si hay un turno abierto,
 * su tiempo transcurrido hasta este momento se incluye en ambos
 * totales.
 */
export async function getMyTimeClockSummary() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado" };
  }

  const todayStr = todayDateOnly();
  const weekStartStr = mondayOfWeek(todayStr);

  const todayStart = parseDateOnly(todayStr);
  const todayEnd = parseDateOnly(addDaysToDateOnly(todayStr, 1));
  const weekStart = parseDateOnly(weekStartStr);
  const weekEnd = parseDateOnly(addDaysToDateOnly(weekStartStr, 7));

  const entries = await prisma.timeClockEntry.findMany({
    where: {
      userId: user.id,
      clockIn: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { clockIn: "asc" },
  });

  const rate = user.hourlyRate !== null ? Number(user.hourlyRate) : null;
  const now = new Date();

  let todayHours = 0;
  let weekHours = 0;
  let hasOpenShift = false;

  for (const entry of entries) {
    const end = entry.clockOut ?? now;
    const hours = (end.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);

    if (!entry.clockOut) hasOpenShift = true;

    weekHours += hours;

    if (entry.clockIn >= todayStart && entry.clockIn < todayEnd) {
      todayHours += hours;
    }
  }

  return {
    success: true,
    hourlyRate: rate,
    hasOpenShift,
    todayHours,
    weekHours,
    todayPay: rate !== null ? todayHours * rate : null,
    weekPay: rate !== null ? weekHours * rate : null,
  };
}

export async function getMyAccessibleBranchesForPayroll() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") return [];

  return prisma.branch.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
