import "server-only";

import { EquipmentStatus, MillingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function millingWorkedMilliseconds(
  sessions: Array<{ startedAt: Date; endedAt: Date | null }>,
  now = new Date(),
) {
  return sessions.reduce(
    (total, session) => total + Math.max(0, (session.endedAt ?? now).getTime() - session.startedAt.getTime()),
    0,
  );
}

export async function pauseMilling(input: { id: string; actorId: string; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const milling = await tx.milling.findUnique({ where: { id: input.id } });
    if (!milling || milling.status !== MillingStatus.ACTIVA) throw new Error("MILLING_NOT_ACTIVE");
    const now = new Date();
    const changed = await tx.milling.updateMany({
      where: { id: milling.id, status: MillingStatus.ACTIVA },
      data: { status: MillingStatus.PAUSADA },
    });
    if (changed.count !== 1) throw new Error("MILLING_STATE_CHANGED");
    await tx.millingWorkSession.updateMany({
      where: { millingId: milling.id, endedAt: null },
      data: { endedAt: now, endedById: input.actorId, endOperationId: crypto.randomUUID(), notes: input.notes ?? undefined },
    });
    await tx.equipment.updateMany({
      where: { id: milling.equipmentId, status: EquipmentStatus.OPERANDO },
      data: { status: EquipmentStatus.DISPONIBLE, currentLoad: 0 },
    });
    return milling;
  });
}

export async function resumeMilling(input: { id: string; actorId: string; notes?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const milling = await tx.milling.findUnique({ where: { id: input.id } });
    if (!milling || milling.status !== MillingStatus.PAUSADA) throw new Error("MILLING_NOT_PAUSED");
    const reserved = await tx.equipment.updateMany({
      where: { id: milling.equipmentId, status: EquipmentStatus.DISPONIBLE },
      data: { status: EquipmentStatus.OPERANDO, currentLoad: milling.cookedKg },
    });
    if (reserved.count !== 1) throw new Error("EQUIPMENT_BUSY");
    await tx.milling.update({ where: { id: milling.id }, data: { status: MillingStatus.ACTIVA } });
    await tx.millingWorkSession.create({
      data: {
        millingId: milling.id,
        startedById: input.actorId,
        startOperationId: crypto.randomUUID(),
        notes: input.notes ?? null,
      },
    });
    return milling;
  });
}
