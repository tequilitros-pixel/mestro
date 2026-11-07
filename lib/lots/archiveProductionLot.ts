import "server-only";

import {
  CookingStatus,
  DistillationStatus,
  EquipmentStatus,
  MillingStatus,
  Prisma,
  RawMaterialMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ArchiveProductionLotError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ArchiveProductionLotError";
  }
}

/**
 * Cierra administrativamente un lote de prueba sin declararlo terminado.
 * No crea producto, no calcula litros finales y no elimina la bitácora.
 */
export async function archiveProductionLot(input: {
  lotId: string;
  actorId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new ArchiveProductionLotError("MISSING_REASON");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Lot" WHERE "id" = ${input.lotId} FOR UPDATE`,
    );

    const lot = await tx.lot.findUnique({
      where: { id: input.lotId },
      include: {
        cookings: { select: { id: true, equipmentId: true, status: true } },
        millings: { select: { id: true, equipmentId: true, status: true } },
        distillations: {
          select: { id: true, equipmentId: true, status: true, finalLiters: true, finalHeartLiters: true },
        },
      },
    });

    if (!lot) throw new ArchiveProductionLotError("LOT_NOT_FOUND");
    if (lot.archivedAt) throw new ArchiveProductionLotError("ALREADY_ARCHIVED");
    if (lot.finishedAt || lot.totalLitersObtained !== null) {
      throw new ArchiveProductionLotError("LOT_ALREADY_FINISHED");
    }

    const [inventoryOutput, completedDistillation] = await Promise.all([
      tx.rawMaterialMovement.findFirst({
        where: { lotId: lot.id, type: RawMaterialMovementType.PRODUCCION },
        select: { id: true },
      }),
      tx.distillation.findFirst({
        where: {
          lotId: lot.id,
          status: DistillationStatus.TERMINADA,
          OR: [
            { finalLiters: { gt: 0 } },
            { finalHeartLiters: { gt: 0 } },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (inventoryOutput || completedDistillation) {
      throw new ArchiveProductionLotError("HAS_REAL_OUTPUT");
    }

    const now = new Date();
    const activeMillingIds = lot.millings
      .filter((milling) => milling.status !== MillingStatus.TERMINADA)
      .map((milling) => milling.id);
    const equipmentIds = [
      ...lot.cookings
        .filter((cooking) => cooking.status !== CookingStatus.TERMINADA)
        .map((cooking) => cooking.equipmentId),
      ...lot.millings
        .filter((milling) => milling.status !== MillingStatus.TERMINADA)
        .map((milling) => milling.equipmentId),
      ...lot.distillations
        .filter((distillation) => distillation.status === DistillationStatus.ACTIVA)
        .map((distillation) => distillation.equipmentId),
    ];

    await Promise.all([
      tx.cooking.updateMany({
        where: { lotId: lot.id, status: { not: CookingStatus.TERMINADA } },
        data: { status: CookingStatus.PAUSADA },
      }),
      tx.milling.updateMany({
        where: { lotId: lot.id, status: { not: MillingStatus.TERMINADA } },
        data: { status: MillingStatus.PAUSADA },
      }),
      activeMillingIds.length > 0
        ? tx.millingWorkSession.updateMany({
            where: { millingId: { in: activeMillingIds }, endedAt: null },
            data: { endedAt: now, endedById: input.actorId },
          })
        : Promise.resolve({ count: 0 }),
      tx.distillation.updateMany({
        where: { lotId: lot.id, status: DistillationStatus.ACTIVA },
        data: {
          status: DistillationStatus.CANCELADA,
          cancelledAt: now,
          cancelledById: input.actorId,
          cancellationReason: `Lote de prueba archivado: ${reason}`,
        },
      }),
      tx.boilerProcessLink.updateMany({
        where: { lotId: lot.id, endedAt: null },
        data: { endedAt: now },
      }),
      equipmentIds.length > 0
        ? tx.equipment.updateMany({
            where: { id: { in: [...new Set(equipmentIds)] }, status: EquipmentStatus.OPERANDO },
            data: { status: EquipmentStatus.DISPONIBLE, currentLoad: 0 },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    await tx.lot.update({
      where: { id: lot.id },
      data: {
        archivedAt: now,
        archivedById: input.actorId,
        archiveReason: reason,
      },
    });

    return { code: lot.code };
  });
}
