import { EquipmentStatus, EquipmentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Disponibilidad de equipo para iniciar una etapa.
 *
 * Un equipo solo puede recibir carga nueva si está DISPONIBLE.
 * Los demás estados significan que ya tiene algo encima
 * (OPERANDO), que está esperando maniobra (ESPERANDO), que se
 * está lavando (LAVADO) o que está fuera de servicio
 * (MANTENIMIENTO).
 *
 * Antes de esto los formularios de nueva cocción/molienda/
 * destilación ofrecían TODOS los equipos activos, así que era
 * posible cargar dos lotes al mismo horno sin que el sistema
 * avisara.
 * ==========================================================
 */

export const AVAILABLE_STATUS = EquipmentStatus.DISPONIBLE;

/** Equipos de los tipos indicados que están libres para recibir carga. */
export async function findAvailableEquipment(types: EquipmentType[]) {
  return prisma.equipment.findMany({
    where: {
      type: { in: types },
      active: true,
      status: AVAILABLE_STATUS,
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, capacity: true, unit: true },
  });
}

/**
 * Reserva un equipo de forma segura: solo lo ocupa si en ese
 * instante sigue DISPONIBLE. Devuelve `false` si alguien más lo
 * tomó entre que se cargó el formulario y se envió.
 *
 * Se usa `updateMany` (no `update`) justamente porque permite
 * condicionar por `status` y saber cuántas filas cambiaron.
 */
export async function reserveEquipment(
  client: Prisma.TransactionClient | typeof prisma,
  equipmentId: string,
  load: number,
): Promise<boolean> {
  const result = await client.equipment.updateMany({
    where: { id: equipmentId, status: AVAILABLE_STATUS },
    data: { status: EquipmentStatus.OPERANDO, currentLoad: load },
  });

  return result.count > 0;
}
