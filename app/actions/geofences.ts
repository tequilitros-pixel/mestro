"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GEOFENCES_PATH = "/timeclock/geofences";

const BRANCH_SELECT = {
  id: true,
  name: true,
  code: true,
  address: true,
  active: true,
  color: true,
  geofenceId: true,
  geofence: { select: { id: true, name: true, radius: true } },
} satisfies Prisma.BranchSelect;

type BranchWithGeofence = Prisma.BranchGetPayload<{ select: typeof BRANCH_SELECT }>;

const GEOFENCE_INCLUDE = {
  branches: { select: { id: true, name: true } },
} satisfies Prisma.GeofenceInclude;

type GeofenceWithBranches = Prisma.GeofenceGetPayload<{ include: typeof GEOFENCE_INCLUDE }>;

// Explícitamente anotamos los tipos de retorno de estas acciones
// como uniones discriminadas de dos miembros completos (en vez de
// dejar que TypeScript los infiera de los `return` sueltos). Sin
// esto, TS aplana los retornos en un solo tipo con todos los campos
// opcionales, y un simple `if (result.error)` deja de descartar
// correctamente el otro caso en el llamador.
type ActionResult<T extends object = object> =
  | { error: string }
  | ({ success: true } & T);

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/**
 * Sucursales (con su geozona asignada, si tiene) y todas las
 * geozonas disponibles. Se usa en Horario > Geozona para editar
 * direcciones, crear/eliminar geozonas y asignarlas a sucursales.
 */
export async function getGeofencesPageData(): Promise<
  ActionResult<{ branches: BranchWithGeofence[]; geofences: GeofenceWithBranches[] }>
> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  const [branches, geofences] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" }, select: BRANCH_SELECT }),
    prisma.geofence.findMany({ orderBy: { name: "asc" }, include: GEOFENCE_INCLUDE }),
  ]);

  return { success: true, branches, geofences };
}

export async function updateBranchAddressAction(
  branchId: string,
  address: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.branch.update({
    where: { id: branchId },
    data: { address: address.trim() === "" ? null : address.trim() },
  });

  revalidatePath(GEOFENCES_PATH);
  return { success: true };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Color de identificación de la sucursal en la cuadrícula de Horario. */
export async function updateBranchColorAction(
  branchId: string,
  color: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  if (color !== null && !HEX_COLOR.test(color)) {
    return { error: "El color debe ser un hexadecimal válido (#RRGGBB)." };
  }

  await prisma.branch.update({
    where: { id: branchId },
    data: { color },
  });

  revalidatePath(GEOFENCES_PATH);
  revalidatePath("/administration/schedule");
  return { success: true };
}

export async function assignGeofenceToBranchAction(
  branchId: string,
  geofenceId: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  await prisma.branch.update({
    where: { id: branchId },
    data: { geofenceId },
  });

  revalidatePath(GEOFENCES_PATH);
  revalidatePath("/timeclock");
  return { success: true };
}

export async function createGeofenceAction({
  name,
  latitude,
  longitude,
  radius,
}: {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<ActionResult<{ geofence: Prisma.GeofenceGetPayload<Record<string, never>> }>> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  if (!name.trim()) {
    return { error: "El nombre de la geozona es obligatorio" };
  }
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { error: "Latitud y longitud deben ser números válidos" };
  }
  if (!Number.isFinite(radius) || radius < 10) {
    return { error: "El radio debe ser de al menos 10 metros" };
  }

  const geofence = await prisma.geofence.create({
    data: { name: name.trim(), latitude, longitude, radius: Math.round(radius) },
  });

  revalidatePath(GEOFENCES_PATH);
  return { success: true, geofence };
}

export async function deleteGeofenceAction(geofenceId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No tienes permiso" };

  // Al eliminar la geozona, las sucursales que la tenían asignada se
  // quedan sin geozona (geofenceId vuelve a null) gracias a la
  // relación opcional; no hace falta desasignarlas a mano primero.
  await prisma.geofence.delete({ where: { id: geofenceId } });

  revalidatePath(GEOFENCES_PATH);
  revalidatePath("/timeclock");
  return { success: true };
}
