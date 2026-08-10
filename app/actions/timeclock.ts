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
import {
  BRANCH_LOCATION_SELECT,
  checkGeofence,
  matchTodaysScheduledShift,
  type Coords,
} from "@/lib/timeclockShared";

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

  const todayStr = todayDateOnly();
  const todayStart = parseDateOnly(todayStr);
  const todayEnd = parseDateOnly(addDaysToDateOnly(todayStr, 1));

  // Un empleado puede checar en una sucursal por dos motivos: la tiene
  // asignada de forma permanente (UserBranch), o tiene un turno
  // programado ahí para hoy (ScheduledShift). Si solo tiene el turno
  // programado, también debe poder checar entrada sin que un admin
  // tenga que darle de alta la sucursal aparte.
  const [assigned, scheduledToday] = await Promise.all([
    prisma.userBranch.findMany({
      where: { userId: user.id },
      include: { branch: { select: BRANCH_LOCATION_SELECT } },
    }),
    // DESCANSO (día libre) no tiene sucursal: no aplica para checar entrada.
    prisma.scheduledShift.findMany({
      where: { userId: user.id, date: { gte: todayStart, lt: todayEnd }, type: "TURNO" },
      include: { branch: { select: BRANCH_LOCATION_SELECT } },
    }),
  ]);

  const byId = new Map<string, (typeof assigned)[number]["branch"]>();
  for (const a of assigned) byId.set(a.branch.id, a.branch);
  for (const s of scheduledToday) {
    if (s.branch) byId.set(s.branch.id, s.branch);
  }

  return Array.from(byId.values());
}

/**
 * Sucursales activas con geozona cuyo radio incluye la posición dada.
 * Permite ofrecer la opción de checar entrada por estar físicamente
 * en el área de una sucursal, aunque el empleado no la tenga asignada
 * ni tenga un turno programado ahí (p. ej. cubrir una sucursal distinta
 * a la suya).
 */
export async function getNearbyBranches(coords: Coords) {
  const user = await getCurrentUser();
  if (!user) return [];

  const branches = await prisma.branch.findMany({
    where: { active: true, geofenceId: { not: null } },
    select: BRANCH_LOCATION_SELECT,
  });

  return branches.filter((branch) => {
    if (!hasGeofence(branch)) return false;
    const distance = distanceMeters(
      branch.geofence.latitude,
      branch.geofence.longitude,
      coords.latitude,
      coords.longitude
    );
    return distance <= branch.geofence.radius;
  });
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

  const scheduledShiftId = await matchTodaysScheduledShift(user.id, branchId);

  const entry = await prisma.timeClockEntry.create({
    data: {
      userId: user.id,
      branchId,
      clockIn: new Date(),
      scheduledShiftId,
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
 * Turnos cerrados más recientes del empleado, con su solicitud de
 * edición más reciente (si tiene una) para poder mostrar el estatus
 * en el checador.
 */
export async function getMyRecentClosedShifts(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.timeClockEntry.findMany({
    where: { userId: user.id, clockOut: { not: null } },
    include: {
      branch: { select: { id: true, name: true } },
      editRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { clockIn: "desc" },
    take: limit,
  });
}

/**
 * El empleado pide corregir las horas de un turno que ya cerró (por
 * ejemplo, olvidó checar salida a tiempo). No modifica el turno de
 * inmediato: crea una solicitud pendiente que un administrador debe
 * aprobar o rechazar desde Personal > Checador.
 */
export async function requestTimeClockEditAction(
  entryId: string,
  newClockIn: string,
  newClockOut: string,
  reason?: string,
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "No autorizado" };
  }

  const entry = await prisma.timeClockEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.userId !== user.id) {
    return { error: "Turno no encontrado" };
  }

  if (!entry.clockOut) {
    return { error: "Este turno sigue abierto. Ciérralo desde el checador antes de corregirlo." };
  }

  const existingPending = await prisma.timeClockEditRequest.findFirst({
    where: { timeClockId: entryId, status: "PENDIENTE" },
  });

  if (existingPending) {
    return { error: "Ya hay una solicitud pendiente de aprobación para este turno." };
  }

  const requestedClockIn = new Date(newClockIn);
  const requestedClockOut = new Date(newClockOut);

  if (Number.isNaN(requestedClockIn.getTime()) || Number.isNaN(requestedClockOut.getTime())) {
    return { error: "Las horas no son válidas" };
  }

  if (requestedClockOut <= requestedClockIn) {
    return { error: "La hora de salida debe ser después de la entrada" };
  }

  await prisma.timeClockEditRequest.create({
    data: {
      timeClockId: entry.id,
      userId: user.id,
      originalClockIn: entry.clockIn,
      originalClockOut: entry.clockOut,
      requestedClockIn,
      requestedClockOut,
      reason: reason?.trim() || null,
    },
  });

  revalidatePath("/timeclock");
  revalidatePath("/administration/personnel/timeclock");

  return { success: true };
}

/**
 * Solicitudes de edición pendientes de revisión, para el panel del
 * administrador en Personal > Checador.
 */
export async function getPendingTimeClockEditRequests() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return [];

  return prisma.timeClockEditRequest.findMany({
    where: { status: "PENDIENTE" },
    include: {
      user: { select: { id: true, name: true } },
      timeClock: { include: { branch: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * El administrador aprueba o rechaza una solicitud de edición. Al
 * aprobar, se aplican las horas corregidas al turno original.
 */
export async function reviewTimeClockEditRequestAction(
  requestId: string,
  approve: boolean,
  reviewNotes?: string,
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  const request = await prisma.timeClockEditRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Solicitud no encontrada" };
  }

  if (request.status !== "PENDIENTE") {
    return { error: "Esta solicitud ya fue revisada" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.timeClockEditRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? "APROBADO" : "RECHAZADO",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes?.trim() || null,
      },
    });

    if (approve) {
      await tx.timeClockEntry.update({
        where: { id: request.timeClockId },
        data: {
          clockIn: request.requestedClockIn,
          clockOut: request.requestedClockOut,
          confirmedByEmployee: false,
        },
      });
    }
  });

  revalidatePath("/timeclock");
  revalidatePath("/administration/personnel/timeclock");

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

/**
 * Un admin/gerente registra una checada completa (entrada y salida)
 * que nunca se hizo desde el checador — por ejemplo, alguien trabajó
 * pero se le olvidó checar por completo ese día. Se marca con
 * `source: MANUAL` para distinguirla de las que sí pasaron por el
 * checador, y queda ligada al turno programado si coincide.
 */
export async function createManualTimeClockEntryAction(input: {
  userId: string;
  branchId: string;
  clockIn: string;
  clockOut: string;
  notes?: string;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return { error: "No tienes permiso" };
  }

  if (!input.userId || !input.branchId || !input.clockIn || !input.clockOut) {
    return { error: "Faltan datos de la checada" };
  }

  const clockIn = new Date(input.clockIn);
  const clockOut = new Date(input.clockOut);

  if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) {
    return { error: "Las horas no son válidas" };
  }

  if (clockOut <= clockIn) {
    return { error: "La hora de salida debe ser después de la entrada" };
  }

  const scheduledShiftId = await prisma.scheduledShift
    .findFirst({
      where: {
        userId: input.userId,
        branchId: input.branchId,
        type: "TURNO",
        date: {
          gte: new Date(clockIn.toISOString().slice(0, 10) + "T00:00:00.000Z"),
          lt: new Date(clockIn.toISOString().slice(0, 10) + "T23:59:59.999Z"),
        },
      },
      select: { id: true },
    })
    .then((s) => s?.id ?? null);

  await prisma.timeClockEntry.create({
    data: {
      userId: input.userId,
      branchId: input.branchId,
      clockIn,
      clockOut,
      confirmedByEmployee: false,
      closedManuallyById: admin.id,
      source: "MANUAL",
      scheduledShiftId,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/administration/personnel/timeclock");
  revalidatePath("/timeclock/payroll");

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
