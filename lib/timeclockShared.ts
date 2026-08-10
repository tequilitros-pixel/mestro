import { prisma } from "@/lib/prisma";
import { addDaysToDateOnly, parseDateOnly, todayDateOnly } from "@/lib/dateOnly";
import { distanceMeters, hasGeofence } from "@/lib/geo";

/**
 * Helpers compartidos entre app/actions/timeclock.ts y
 * app/actions/kiosk.ts. Viven fuera de un archivo "use server" a
 * propósito: Next.js exige que TODO lo exportado de un módulo con
 * "use server" sea una función async (son Server Actions), así que
 * una constante o una función síncrona como `checkGeofence` rompe el
 * build si se exporta desde ahí.
 */

export const BRANCH_LOCATION_SELECT = {
  id: true,
  name: true,
  geofence: {
    select: { latitude: true, longitude: true, radius: true },
  },
} as const;

export type Coords = { latitude: number; longitude: number };

/**
 * Si la sucursal tiene geozona asignada, exige coordenadas del
 * empleado y verifica que estén dentro del radio permitido.
 * Devuelve `null` si todo está bien (o si la sucursal no tiene
 * geozona), o un mensaje de error listo para mostrar.
 */
export function checkGeofence(
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

/**
 * Busca el turno programado (ScheduledShift tipo TURNO) de hoy para
 * este empleado en esta sucursal, para vincularlo con la checada que
 * está por crearse. Permite comparar PROGRAMADO vs REAL en Nómina sin
 * pedirle al empleado que elija turno a mano.
 *
 * Si hay más de un turno programado hoy en esa sucursal (turno
 * partido), evita reusar uno que ya quedó ligado a otra checada y
 * toma el que empieza más temprano de los que sigan libres.
 */
export async function matchTodaysScheduledShift(
  userId: string,
  branchId: string,
): Promise<string | null> {
  const todayStr = todayDateOnly();
  const todayStart = parseDateOnly(todayStr);
  const todayEnd = parseDateOnly(addDaysToDateOnly(todayStr, 1));

  const candidates = await prisma.scheduledShift.findMany({
    where: {
      userId,
      branchId,
      type: "TURNO",
      date: { gte: todayStart, lt: todayEnd },
    },
    select: { id: true, startTime: true },
    orderBy: { startTime: "asc" },
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  const alreadyLinked = await prisma.timeClockEntry.findMany({
    where: { scheduledShiftId: { in: candidates.map((c) => c.id) } },
    select: { scheduledShiftId: true },
  });
  const linkedIds = new Set(alreadyLinked.map((e) => e.scheduledShiftId));

  const available = candidates.filter((c) => !linkedIds.has(c.id));
  return (available[0] ?? candidates[0]).id;
}
