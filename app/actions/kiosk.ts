"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addDaysToDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import {
  BRANCH_LOCATION_SELECT,
  matchTodaysScheduledShift,
  type Coords,
} from "@/lib/timeclockShared";
import {
  evaluateGeofence,
  geofenceDecision,
  geofenceMessage,
  requiresLocation,
  type LocationInput,
} from "@/lib/workforce/geofence";

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

async function getLocationPolicy() {
  return prisma.workforceSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
}

async function canClockAtBranch(userId: string, branchId: string) {
  const today = parseDateOnly(todayDateOnly());
  const tomorrow = parseDateOnly(addDaysToDateOnly(todayDateOnly(), 1));
  const [assignment, scheduled] = await Promise.all([
    prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
      select: { id: true },
    }),
    prisma.scheduledShift.findFirst({
      where: { userId, branchId, type: "TURNO", date: { gte: today, lt: tomorrow } },
      select: { id: true },
    }),
  ]);
  return Boolean(assignment || scheduled);
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
export async function getKioskBranches(coords?: Coords) {
  const user = await requireAnyUser();
  if (!user) return [];

  const [branches, policy] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: BRANCH_LOCATION_SELECT }),
    getLocationPolicy(),
  ]);

  return branches
    .filter((branch) => {
      if (!requiresLocation(branch, policy.requireGeolocationClockIn)) return true;
      if (policy.outsideBehavior === "ALLOW_WITH_EXCEPTION") return true;
      if (!coords) return false;
      return evaluateGeofence(
        branch,
        { sample: coords },
        policy.requireGeolocationClockIn,
        policy.maximumAccuracyMeters,
      ).result === "INSIDE";
    })
    .map((branch) => ({
      ...branch,
      locationRequired: requiresLocation(branch, policy.requireGeolocationClockIn),
    }));
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
export async function kioskClockInAction(userId: string, pin: string, branchId: string, location?: LocationInput) {
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

  const [branch, policy, authorized] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_LOCATION_SELECT }),
    getLocationPolicy(),
    canClockAtBranch(employee.id, branchId),
  ]);
  if (!branch || !branch.active) return { error: "Sucursal no encontrada" };
  if (!authorized) return { error: "El empleado no está autorizado para checar en esta sucursal." };

  const geofenceResult = evaluateGeofence(branch, location, policy.requireGeolocationClockIn, policy.maximumAccuracyMeters);
  const decision = geofenceDecision(geofenceResult.result, policy.outsideBehavior);
  if (!decision.allow) {
    return { error: geofenceMessage(geofenceResult) ?? "No pudimos validar la ubicación.", geofenceResult: geofenceResult.result };
  }

  const scheduledShiftId = await matchTodaysScheduledShift(employee.id, branchId);

  await prisma.$transaction(async (tx) => {
    const entry = await tx.timeClockEntry.create({
      data: { userId: employee.id, branchId, clockIn: new Date(), scheduledShiftId },
    });
    await tx.clockGeolocationEvidence.create({
      data: {
        timeClockId: entry.id,
        action: "CLOCK_IN",
        result: geofenceResult.result,
        distanceMeters: geofenceResult.distanceMeters,
        accuracyMeters: geofenceResult.accuracyMeters,
        checkedAt: geofenceResult.checkedAt,
        reviewStatus: decision.needsReview && policy.requireOutsideReview ? "PENDING" : "NOT_REQUIRED",
      },
    });
  });

  revalidatePath("/timeclock");
  return { success: true, employeeName: employee.name, warning: decision.needsReview ? geofenceMessage(geofenceResult) : null };
}

/**
 * Checa salida en modo kiosco. A diferencia del checador personal, no
 * permite ajustar las horas ahí mismo (se cierra con la hora actual);
 * si hace falta corregir, el empleado puede pedirlo después con su
 * propia sesión, como ya funciona hoy.
 */
export async function kioskClockOutAction(userId: string, pin: string, location?: LocationInput) {
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

  const policy = await getLocationPolicy();
  const geofenceResult = evaluateGeofence(entry.branch, location, policy.requireGeolocationClockOut, policy.maximumAccuracyMeters);
  const decision = geofenceDecision(geofenceResult.result, policy.outsideBehavior);
  if (!decision.allow) {
    return { error: geofenceMessage(geofenceResult) ?? "No pudimos validar la ubicación.", geofenceResult: geofenceResult.result };
  }

  await prisma.$transaction(async (tx) => {
    await tx.timeClockEntry.update({
      where: { id: entry.id },
      data: { clockOut: new Date(), confirmedByEmployee: true },
    });
    await tx.clockGeolocationEvidence.upsert({
      where: { timeClockId_action: { timeClockId: entry.id, action: "CLOCK_OUT" } },
      update: {},
      create: {
        timeClockId: entry.id,
        action: "CLOCK_OUT",
        result: geofenceResult.result,
        distanceMeters: geofenceResult.distanceMeters,
        accuracyMeters: geofenceResult.accuracyMeters,
        checkedAt: geofenceResult.checkedAt,
        reviewStatus: decision.needsReview && policy.requireOutsideReview ? "PENDING" : "NOT_REQUIRED",
      },
    });
  });

  revalidatePath("/timeclock");
  return { success: true, employeeName: employee.name, warning: decision.needsReview ? geofenceMessage(geofenceResult) : null };
}
