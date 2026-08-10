"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addDaysToDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import { distanceMeters, hasGeofence } from "@/lib/geo";
import {
  BRANCH_LOCATION_SELECT,
  checkGeofence,
  matchTodaysScheduledShift,
  type Coords,
} from "@/lib/timeclockShared";

/**
 * ==========================================================
 * Checador compartido (kiosco)
 * ----------------------------------------------------------
 * Pensado para una tablet/teléfono fijo en la sucursal que usan
 * varios empleados: en vez de que cada quien inicie sesión completa,
 * eligen su nombre de una lista y capturan su PIN de 4 dígitos. La
 * geozona sigue siendo la que limita dónde se puede checar — no hay
 * un "dispositivo dado de alta" aparte.
 *
 * La página del kiosco (/timeclock/kiosk) sigue detrás del login
 * normal: alguien con acceso a MAESTRO la abre una vez en el
 * dispositivo de la sucursal, y de ahí en adelante el PIN es lo que
 * identifica a cada empleado que se acerca a checar, sin cerrar esa
 * sesión ni pedirle su contraseña completa a nadie.
 * ==========================================================
 */

const PIN_REGEX = /^\d{4}$/;
const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

async function requireAnyUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/** Da de alta o cambia el PIN de un empleado. Solo admins. */
export async function setEmployeePinAction(userId: string, pin: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  if (!PIN_REGEX.test(pin)) {
    return { error: "El PIN debe ser de exactamente 4 dígitos" };
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { pinHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  revalidatePath("/administration/personnel");
  return { success: true };
}

/** Quita el PIN de un empleado (ya no podrá usar el kiosco). Solo admins. */
export async function clearEmployeePinAction(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.user.update({ where: { id: userId }, data: { pinHash: null } });

  revalidatePath("/administration/personnel");
  return { success: true };
}

/**
 * Sucursales con geozona cuyo radio incluye la posición del
 * dispositivo. El kiosco se ubica solo, igual que el checador
 * personal — no depende de qué empleado esté frente a la pantalla.
 */
export async function getKioskBranches(coords: Coords) {
  const user = await requireAnyUser();
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
      coords.longitude,
    );
    return distance <= branch.geofence.radius;
  });
}

export type KioskEmployee = {
  id: string;
  name: string;
  hasOpenShift: boolean;
};

/**
 * Empleados que pueden usar el kiosco en esta sucursal: los que la
 * tienen asignada o tienen turno programado hoy ahí (mismo criterio
 * que el checador personal), y que ya tienen un PIN configurado —
 * sin PIN no aparecen, porque no hay forma de verificarlos.
 */
export async function getKioskEmployees(branchId: string): Promise<KioskEmployee[]> {
  const user = await requireAnyUser();
  if (!user) return [];

  const todayStr = todayDateOnly();
  const todayStart = parseDateOnly(todayStr);
  const todayEnd = parseDateOnly(addDaysToDateOnly(todayStr, 1));

  const [assigned, scheduledToday, openShifts] = await Promise.all([
    prisma.userBranch.findMany({
      where: { branchId },
      select: { userId: true },
    }),
    prisma.scheduledShift.findMany({
      where: { branchId, type: "TURNO", date: { gte: todayStart, lt: todayEnd } },
      select: { userId: true },
    }),
    prisma.timeClockEntry.findMany({
      where: { clockOut: null },
      select: { userId: true },
    }),
  ]);

  const candidateIds = new Set<string>();
  for (const a of assigned) candidateIds.add(a.userId);
  for (const s of scheduledToday) candidateIds.add(s.userId);

  if (candidateIds.size === 0) return [];

  const openShiftIds = new Set(openShifts.map((s) => s.userId));

  const employees = await prisma.user.findMany({
    where: { id: { in: Array.from(candidateIds) }, active: true, pinHash: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return employees.map((e) => ({ id: e.id, name: e.name, hasOpenShift: openShiftIds.has(e.id) }));
}

async function verifyPin(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, pinHash: true, active: true, failedLoginAttempts: true, lockedUntil: true },
  });
}

async function registerFailedPin(userId: string, attempts: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil: attempts >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
    },
  });
}

/**
 * Checa entrada en modo kiosco: en vez de `getCurrentUser()`, la
 * identidad la da el PIN de la persona seleccionada en la lista.
 */
export async function kioskClockInAction(userId: string, pin: string, branchId: string, coords?: Coords) {
  const employee = await verifyPin(userId);
  if (!employee || !employee.active || !employee.pinHash) {
    return { error: "Empleado no válido" };
  }

  if (employee.lockedUntil && employee.lockedUntil > new Date()) {
    return { error: "PIN bloqueado por intentos fallidos. Pide a un administrador que lo restablezca." };
  }

  const pinMatches = await bcrypt.compare(pin, employee.pinHash);
  if (!pinMatches) {
    await registerFailedPin(employee.id, employee.failedLoginAttempts + 1);
    return { error: "PIN incorrecto" };
  }

  if (employee.failedLoginAttempts > 0) {
    await prisma.user.update({ where: { id: employee.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const openShift = await prisma.timeClockEntry.findFirst({
    where: { userId: employee.id, clockOut: null },
  });
  if (openShift) {
    return { error: `${employee.name} ya tiene un turno abierto.` };
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_LOCATION_SELECT });
  if (!branch) return { error: "Sucursal no encontrada" };

  const geofenceResult = checkGeofence(branch, coords);
  if (geofenceResult && "error" in geofenceResult) {
    return { error: geofenceResult.error };
  }

  const scheduledShiftId = await matchTodaysScheduledShift(employee.id, branchId);

  await prisma.timeClockEntry.create({
    data: { userId: employee.id, branchId, clockIn: new Date(), scheduledShiftId },
  });

  revalidatePath("/timeclock");
  return { success: true, employeeName: employee.name };
}

/**
 * Checa salida en modo kiosco. A diferencia del checador personal, no
 * permite ajustar las horas ahí mismo (se cierra con la hora actual);
 * si hace falta corregir, el empleado puede pedirlo después con su
 * propia sesión, como ya funciona hoy.
 */
export async function kioskClockOutAction(userId: string, pin: string, coords?: Coords) {
  const employee = await verifyPin(userId);
  if (!employee || !employee.active || !employee.pinHash) {
    return { error: "Empleado no válido" };
  }

  if (employee.lockedUntil && employee.lockedUntil > new Date()) {
    return { error: "PIN bloqueado por intentos fallidos. Pide a un administrador que lo restablezca." };
  }

  const pinMatches = await bcrypt.compare(pin, employee.pinHash);
  if (!pinMatches) {
    await registerFailedPin(employee.id, employee.failedLoginAttempts + 1);
    return { error: "PIN incorrecto" };
  }

  if (employee.failedLoginAttempts > 0) {
    await prisma.user.update({ where: { id: employee.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const entry = await prisma.timeClockEntry.findFirst({
    where: { userId: employee.id, clockOut: null },
    include: { branch: { select: BRANCH_LOCATION_SELECT } },
  });
  if (!entry) return { error: `${employee.name} no tiene un turno abierto.` };

  const geofenceResult = checkGeofence(entry.branch, coords);
  if (geofenceResult && "error" in geofenceResult) {
    return { error: geofenceResult.error };
  }

  await prisma.timeClockEntry.update({
    where: { id: entry.id },
    data: { clockOut: new Date(), confirmedByEmployee: true },
  });

  revalidatePath("/timeclock");
  return { success: true, employeeName: employee.name };
}
