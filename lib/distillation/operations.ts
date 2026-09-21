import "server-only";

import {
  DistillationStatus,
  DistillationType,
  EquipmentStatus,
  LotStage,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { advanceLotStage } from "@/lib/lotStage";

const EPSILON = 0.005;

export class DistillationOperationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "DistillationOperationError";
  }
}

type Source = {
  id: string;
  lotId: string;
  lotCode: string;
  type: DistillationType;
  label: string;
  tankName: string | null;
  availableLiters: number;
  sourceLiters: number;
  initialAlcohol: number | null;
};

export async function getDistillationSources(): Promise<Source[]> {
  const [fermentations, destrozados] = await Promise.all([
    prisma.fermentation.findMany({
      where: { status: "TERMINADA" },
      include: {
        lot: true,
        distillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true },
        },
      },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.distillation.findMany({
      where: { status: DistillationStatus.TERMINADA, type: DistillationType.DESTROZADO },
      include: {
        lot: true,
        derivedDistillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true },
        },
        sourceFermentation: { select: { tank: true } },
      },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  const result: Source[] = [];
  for (const fermentation of fermentations) {
    const allocated = fermentation.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const availableLiters = Math.max(0, fermentation.mustLiters - allocated);
    if (availableLiters > EPSILON) {
      result.push({
        id: fermentation.id,
        lotId: fermentation.lotId,
        lotCode: fermentation.lot.code,
        type: DistillationType.DESTROZADO,
        label: "Destrozado",
        tankName: fermentation.tank,
        availableLiters,
        sourceLiters: fermentation.mustLiters,
        initialAlcohol: fermentation.finalAlcohol,
      });
    }
  }

  for (const destrozado of destrozados) {
    const sourceLiters =
      destrozado.finalHeartLiters && destrozado.finalHeartLiters > 0
        ? destrozado.finalHeartLiters
        : destrozado.finalLiters ?? 0;
    const allocated = destrozado.derivedDistillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const availableLiters = Math.max(0, sourceLiters - allocated);
    if (availableLiters > EPSILON) {
      result.push({
        id: destrozado.id,
        lotId: destrozado.lotId,
        lotCode: destrozado.lot.code,
        type: DistillationType.RECTIFICACION,
        label: "Rectificación",
        tankName: destrozado.sourceFermentation?.tank ?? null,
        availableLiters,
        sourceLiters,
        initialAlcohol: destrozado.finalAlcohol,
      });
    }
  }

  return result;
}

export async function startDistillationRun(input: {
  sourceId: string;
  type: DistillationType;
  equipmentId: string;
  loadedLiters: number;
  fillPercent: number;
  initialAlcohol: number | null;
}) {
  if (!Number.isFinite(input.loadedLiters) || input.loadedLiters <= 0) {
    throw new DistillationOperationError("Los litros deben ser mayores a cero.", "INVALID_LITERS");
  }
  if (!Number.isFinite(input.fillPercent) || input.fillPercent <= 0 || input.fillPercent > 100) {
    throw new DistillationOperationError("El porcentaje de carga debe estar entre 1 y 100.", "INVALID_FILL_PERCENT");
  }
  if (input.initialAlcohol !== null && (!Number.isFinite(input.initialAlcohol) || input.initialAlcohol < 0 || input.initialAlcohol > 100)) {
    throw new DistillationOperationError("El alcohol inicial debe estar entre 0 y 100.", "INVALID_ALCOHOL");
  }

  return prisma.$transaction(async (tx) => {
    let lotId: string;
    let sourceLiters: number;
    let sourceFermentationId: string | null = null;
    let sourceDistillationId: string | null = null;

    if (input.type === DistillationType.DESTROZADO) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Fermentation" WHERE "id" = ${input.sourceId} FOR UPDATE`);
      const source = await tx.fermentation.findUnique({ where: { id: input.sourceId } });
      if (!source || source.status !== "TERMINADA") {
        throw new DistillationOperationError("La fermentación ya no está disponible.", "SOURCE_UNAVAILABLE");
      }
      lotId = source.lotId;
      sourceLiters = source.mustLiters;
      sourceFermentationId = source.id;
    } else {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Distillation" WHERE "id" = ${input.sourceId} FOR UPDATE`);
      const source = await tx.distillation.findUnique({ where: { id: input.sourceId } });
      if (!source || source.status !== DistillationStatus.TERMINADA || source.type !== DistillationType.DESTROZADO) {
        throw new DistillationOperationError("El destrozado ya no está disponible.", "SOURCE_UNAVAILABLE");
      }
      lotId = source.lotId;
      sourceLiters = source.finalHeartLiters && source.finalHeartLiters > 0
        ? source.finalHeartLiters
        : source.finalLiters ?? 0;
      sourceDistillationId = source.id;
    }

    const allocated = await tx.distillation.aggregate({
      where: input.type === DistillationType.DESTROZADO
        ? { sourceFermentationId, status: { not: DistillationStatus.CANCELADA } }
        : { sourceDistillationId, status: { not: DistillationStatus.CANCELADA } },
      _sum: { loadedLiters: true },
    });
    const remaining = sourceLiters - (allocated._sum.loadedLiters ?? 0);
    if (input.loadedLiters - remaining > EPSILON) {
      throw new DistillationOperationError(
        `Solo quedan ${remaining.toFixed(2)} L disponibles en la fuente seleccionada.`,
        "SOURCE_OVERALLOCATED",
      );
    }

    const equipment = await tx.equipment.findFirst({
      where: { id: input.equipmentId, type: "ALAMBIQUE", active: true },
      select: { capacity: true, status: true },
    });
    if (!equipment || equipment.status !== EquipmentStatus.DISPONIBLE) {
      throw new DistillationOperationError("El alambique ya está ocupado.", "EQUIPMENT_BUSY");
    }
    const permittedCapacity = equipment.capacity * input.fillPercent / 100;
    if (input.loadedLiters - permittedCapacity > EPSILON) {
      throw new DistillationOperationError(
        `La carga excede ${input.fillPercent.toFixed(1)}% de capacidad (${permittedCapacity.toFixed(2)} L).`,
        "CAPACITY_EXCEEDED",
      );
    }

    const reserved = await tx.equipment.updateMany({
      where: { id: input.equipmentId, status: EquipmentStatus.DISPONIBLE },
      data: { status: EquipmentStatus.OPERANDO, currentLoad: input.loadedLiters },
    });
    if (reserved.count !== 1) {
      throw new DistillationOperationError("El alambique fue ocupado por otro proceso.", "EQUIPMENT_BUSY");
    }

    const run = await tx.distillation.create({
      data: {
        lotId,
        equipmentId: input.equipmentId,
        type: input.type,
        loadedLiters: input.loadedLiters,
        fillPercent: input.fillPercent,
        initialAlcohol: input.initialAlcohol,
        sourceFermentationId,
        sourceDistillationId,
      },
    });

    await advanceLotStage(
      tx,
      lotId,
      input.type === DistillationType.RECTIFICACION ? LotStage.RECTIFICACION : LotStage.DESTILACION,
    );
    return run;
  });
}

export async function cancelDistillationRun(input: {
  id: string;
  actorId: string;
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new DistillationOperationError("Indica el motivo de cancelación.", "MISSING_REASON");
  }
  return prisma.$transaction(async (tx) => {
    const run = await tx.distillation.findUnique({ where: { id: input.id } });
    if (!run || run.status !== DistillationStatus.ACTIVA) {
      throw new DistillationOperationError("La corrida ya no se puede cancelar.", "NOT_ACTIVE");
    }
    await tx.distillation.update({
      where: { id: run.id },
      data: {
        status: DistillationStatus.CANCELADA,
        cancelledAt: new Date(),
        cancelledById: input.actorId,
        cancellationReason: input.reason.trim(),
      },
    });
    await tx.equipment.updateMany({
      where: { id: run.equipmentId, status: EquipmentStatus.OPERANDO },
      data: { status: EquipmentStatus.DISPONIBLE, currentLoad: 0 },
    });
    await tx.boilerProcessLink.updateMany({
      where: { processType: "DESTILACION", processId: run.id, endedAt: null },
      data: { endedAt: new Date() },
    });
  });
}

export async function reconcileLotDistillationStage(
  tx: Prisma.TransactionClient,
  lotId: string,
  completedType: DistillationType,
) {
  if (completedType === DistillationType.DESTROZADO) {
    const sources = await tx.fermentation.findMany({
      where: { lotId, status: "TERMINADA" },
      include: { distillations: { where: { status: { not: DistillationStatus.CANCELADA } }, select: { loadedLiters: true, status: true } } },
    });
    const complete = sources.length > 0 && sources.every((source) => {
      const allocated = source.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
      return source.mustLiters - allocated <= EPSILON && source.distillations.every((run) => run.status === DistillationStatus.TERMINADA);
    });
    if (complete) await advanceLotStage(tx, lotId, LotStage.RECTIFICACION);
    return complete;
  }

  const sources = await tx.distillation.findMany({
    where: { lotId, type: DistillationType.DESTROZADO, status: DistillationStatus.TERMINADA },
    include: { derivedDistillations: { where: { status: { not: DistillationStatus.CANCELADA } }, select: { loadedLiters: true, status: true } } },
  });
  const complete = sources.length > 0 && sources.every((source) => {
    const sourceLiters = source.finalHeartLiters && source.finalHeartLiters > 0 ? source.finalHeartLiters : source.finalLiters ?? 0;
    const allocated = source.derivedDistillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    return sourceLiters - allocated <= EPSILON && source.derivedDistillations.length > 0 && source.derivedDistillations.every((run) => run.status === DistillationStatus.TERMINADA);
  });
  if (complete) await advanceLotStage(tx, lotId, LotStage.TERMINADO);
  return complete;
}
