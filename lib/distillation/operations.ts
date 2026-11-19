import "server-only";

import {
  DistillationStatus,
  DistillationType,
  EquipmentStatus,
  DistillationReceiverStatus,
  LotStage,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { advanceLotStage } from "@/lib/lotStage";
import { receiverTotals, destrozadoProducedLiters } from "@/lib/distillation/receivers";
import { DistillationOperationError } from "@/lib/distillation/errors";

const EPSILON = 0.005;

export { DistillationOperationError } from "@/lib/distillation/errors";
type Source = {
  id: string;
  lotId: string;
  lotCode: string;
  type: DistillationType;
  sourceKind: "FERMENTATION" | "DISTILLATION" | "RECEIVER";
  label: string;
  tankName: string | null;
  availableLiters: number;
  sourceLiters: number;
  initialAlcohol: number | null;
};

export async function getDistillationSources(lotId?: string): Promise<Source[]> {
  const [fermentations, receivers] = await Promise.all([
    prisma.fermentation.findMany({
      where: { status: "TERMINADA", ...(lotId ? { lotId } : {}), lot: { stage: { not: LotStage.TERMINADO } } },
      include: {
        lot: true,
        distillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true, status: true, finishedAt: true },
        },
      },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.distillationReceiver.findMany({
      where: { status: DistillationReceiverStatus.READY, ...(lotId ? { lotId } : {}), lot: { stage: { not: LotStage.TERMINADO } } },
      include: {
        lot: { select: { code: true } },
        transfers: true,
        rectifications: { select: { loadedLiters: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Una fuente marcada como tina vacía no es inventario físico disponible.
  // El ajuste se conserva en la bitácora de AuditEvent, sin modificar litros históricos.
  const sourceEvents = fermentations.length
    ? await prisma.auditEvent.findMany({
        where: {
          entityType: "Fermentation",
          action: { in: ["FERMENTATION_SOURCE_EMPTIED", "FERMENTATION_SOURCE_AVAILABLE"] },
          entityId: { in: fermentations.map((source) => source.id) },
        },
        select: { entityId: true, action: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const drainedIds = new Set(sourceEvents.filter((event) => event.action === "FERMENTATION_SOURCE_EMPTIED").map((event) => event.entityId));
  const verifiedAt = new Map<string, Date>();
  for (const event of sourceEvents) {
    if (event.action === "FERMENTATION_SOURCE_AVAILABLE" && !verifiedAt.has(event.entityId)) {
      verifiedAt.set(event.entityId, event.createdAt);
    }
  }

  const result: Source[] = [];
  for (const fermentation of fermentations) {
    if (drainedIds.has(fermentation.id)) continue;
    const allocated = fermentation.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const availableLiters = Math.max(0, fermentation.mustLiters - allocated);
    const completedRuns = fermentation.distillations.filter((run) => run.status === DistillationStatus.TERMINADA);
    const hasActive = fermentation.distillations.some((run) => run.status === DistillationStatus.ACTIVA);
    const lastCompletedAt = completedRuns.reduce((last, run) => run.finishedAt && run.finishedAt > last ? run.finishedAt : last, new Date(0));
    // Después de terminar corridas, cualquier saldo residual solo es CONTABLE
    // hasta que el operario confirme que hay mosto físico todavía.
    const verified = verifiedAt.get(fermentation.id);
    const physicalStockConfirmed = !completedRuns.length || hasActive || (verified && verified >= lastCompletedAt);
    if (availableLiters > EPSILON && physicalStockConfirmed) {
      result.push({
        id: fermentation.id,
        lotId: fermentation.lotId,
        lotCode: fermentation.lot.code,
        type: DistillationType.DESTROZADO,
        sourceKind: "FERMENTATION",
        label: "Destrozado",
        tankName: fermentation.tank,
        availableLiters,
        sourceLiters: fermentation.mustLiters,
        initialAlcohol: fermentation.finalAlcohol,
      });
    }
  }

  // El destrozado terminado debe pasar por el tanque receptor.
  // No ofrecer corridas individuales como fuente directa para rectificación.

  for (const receiver of receivers) {
    const stock = receiverTotals(receiver);
    if (stock.availableLiters > EPSILON) {
      result.push({
        id: receiver.id,
        lotId: receiver.lotId,
        lotCode: receiver.lot.code,
        type: DistillationType.RECTIFICACION,
        sourceKind: "RECEIVER",
        label: "Rectificación desde tanque receptor",
        tankName: receiver.name,
        availableLiters: stock.availableLiters,
        sourceLiters: stock.receivedLiters,
        initialAlcohol: stock.initialAlcohol,
      });
    }
  }

  return result;
}

export async function startDistillationRun(input: {
  sourceId: string;
  expectedLotId?: string;
  type: DistillationType;
  sourceKind?: "FERMENTATION" | "DISTILLATION" | "RECEIVER";
  plannedReceiverId?: string | null;
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
    let sourceReceiverId: string | null = null;
    let measuredSourceAlcohol: number | null = null;

    if (input.type === DistillationType.DESTROZADO) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Fermentation" WHERE "id" = ${input.sourceId} FOR UPDATE`);
      const source = await tx.fermentation.findUnique({ where: { id: input.sourceId } });
      if (!source || source.status !== "TERMINADA") {
        throw new DistillationOperationError("La fermentación ya no está disponible.", "SOURCE_UNAVAILABLE");
      }
      const [lot, drained] = await Promise.all([
        tx.lot.findUnique({ where: { id: source.lotId }, select: { stage: true } }),
        tx.auditEvent.findFirst({
          where: { entityType: "Fermentation", entityId: source.id, action: "FERMENTATION_SOURCE_EMPTIED" },
          select: { id: true },
        }),
      ]);
      if (!lot || lot.stage === LotStage.TERMINADO || drained) {
        throw new DistillationOperationError("Esta tina ya fue cerrada o el lote está terminado.", "SOURCE_CLOSED");
      }
      const currentRuns = await tx.distillation.findMany({
        where: { sourceFermentationId: source.id, status: { not: DistillationStatus.CANCELADA } },
        select: { status: true, loadedLiters: true, finishedAt: true },
      });
      const completedRuns = currentRuns.filter((run) => run.status === DistillationStatus.TERMINADA);
      if (completedRuns.length > 0 && !currentRuns.some((run) => run.status === DistillationStatus.ACTIVA)) {
        const verified = await tx.auditEvent.findFirst({
          where: { entityType: "Fermentation", entityId: source.id, action: "FERMENTATION_SOURCE_AVAILABLE" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (!verified || completedRuns.some((run) => run.finishedAt && run.finishedAt > verified.createdAt)) {
          throw new DistillationOperationError(
            "Esta tina tiene saldo contable pendiente. Confirma que todavía tiene mosto en la conciliación de fuentes.",
            "PHYSICAL_STOCK_NOT_CONFIRMED",
          );
        }
      }
      lotId = source.lotId;
      sourceLiters = source.mustLiters;
      sourceFermentationId = source.id;
    } else if (input.sourceKind === "RECEIVER" && input.type === DistillationType.RECTIFICACION) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DistillationReceiver" WHERE "id" = ${input.sourceId} FOR UPDATE`);
      const receiver = await tx.distillationReceiver.findUnique({
        where: { id: input.sourceId },
        include: { transfers: true, rectifications: { select: { loadedLiters: true, status: true } } },
      });
      if (!receiver || receiver.status !== DistillationReceiverStatus.READY) {
        throw new DistillationOperationError("El tanque aún no está listo para rectificación.", "RECEIVER_NOT_READY");
      }
      lotId = receiver.lotId;
      sourceLiters = receiver.transfers.reduce((sum, transfer) => sum + transfer.liters, 0);
      sourceReceiverId = receiver.id;
      measuredSourceAlcohol = receiverTotals(receiver).initialAlcohol;
    } else if (!input.sourceKind || input.sourceKind === "DISTILLATION") {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Distillation" WHERE "id" = ${input.sourceId} FOR UPDATE`);
      const source = await tx.distillation.findUnique({ where: { id: input.sourceId } });
      if (!source || source.status !== DistillationStatus.TERMINADA || source.type !== DistillationType.DESTROZADO || await tx.distillationReceiverTransfer.findUnique({ where: { distillationId: input.sourceId } })) {
        throw new DistillationOperationError("El destrozado ya no está disponible.", "SOURCE_UNAVAILABLE");
      }
      lotId = source.lotId;
      sourceLiters = source.finalHeartLiters && source.finalHeartLiters > 0
        ? source.finalHeartLiters
        : source.finalLiters ?? 0;
      sourceDistillationId = source.id;
    } else {
      throw new DistillationOperationError("La fuente seleccionada no es válida.", "INVALID_SOURCE");
    }

    // La selección del lote no es solo un filtro visual: rechazar formularios
    // antiguos o manipulados que intenten cargar producto de otro lote.
    if (input.expectedLotId && lotId !== input.expectedLotId) {
      throw new DistillationOperationError(
        "La tina o el tanque seleccionado no pertenece al lote actual.",
        "DIFFERENT_LOT",
      );
    }

    let plannedReceiverId: string | null = null;
    if (input.plannedReceiverId) {
      if (input.type !== DistillationType.DESTROZADO) {
        throw new DistillationOperationError("Solo el destrozado se envía al tanque receptor.", "INVALID_RECEIVER");
      }
      const receiver = await tx.distillationReceiver.findUnique({ where: { id: input.plannedReceiverId } });
      if (!receiver || receiver.status !== DistillationReceiverStatus.OPEN || receiver.lotId !== lotId) {
        throw new DistillationOperationError("El tanque no está abierto o pertenece a otro lote.", "RECEIVER_UNAVAILABLE");
      }
      plannedReceiverId = receiver.id;
    }

    const allocated = await tx.distillation.aggregate({
      where: input.type === DistillationType.DESTROZADO
        ? { sourceFermentationId, status: { not: DistillationStatus.CANCELADA } }
        : sourceReceiverId
          ? { sourceReceiverId, status: { not: DistillationStatus.CANCELADA } }
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
        initialAlcohol: input.initialAlcohol ?? measuredSourceAlcohol,
        sourceFermentationId,
        sourceDistillationId,
        sourceReceiverId,
        plannedReceiverId,
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
    if (run.type === DistillationType.RECTIFICACION && run.sourceReceiverId) {
      const source = await tx.distillationReceiver.findUnique({ where: { id: run.sourceReceiverId } });
      if (source) {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${source.name}))::text AS "lock"`);
        const subsequentCycle = await tx.distillationReceiver.findFirst({
          where: { name: source.name, createdAt: { gt: source.createdAt } },
          select: { id: true },
        });
        if (subsequentCycle) {
          throw new DistillationOperationError(
            "Este tanque físico ya se reutilizó. No se puede devolver automáticamente la carga cancelada a su recepción anterior; requiere conciliación de volumen.",
            "RECEIVER_REUSED",
          );
        }
      }
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
    const closedSources = sources.length
      ? await tx.auditEvent.findMany({
          where: { entityType: "Fermentation", action: "FERMENTATION_SOURCE_EMPTIED", entityId: { in: sources.map((source) => source.id) } },
          select: { entityId: true },
        })
      : [];
    const closedIds = new Set(closedSources.map((row) => row.entityId));
    const complete = sources.length > 0 && sources.every((source) => {
      const allocated = source.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
      return (closedIds.has(source.id) || source.mustLiters - allocated <= EPSILON)
        && source.distillations.every((run) => run.status === DistillationStatus.TERMINADA);
    });
    if (complete) await advanceLotStage(tx, lotId, LotStage.RECTIFICACION);
    return complete;
  }

  const [sources, receivers, activeDestrozados] = await Promise.all([
    tx.distillation.findMany({
      where: { lotId, type: DistillationType.DESTROZADO, status: DistillationStatus.TERMINADA },
      include: {
        receiverTransfer: true,
        derivedDistillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true, status: true },
        },
      },
    }),
    tx.distillationReceiver.findMany({
      where: { lotId },
      include: {
        transfers: true,
        rectifications: { select: { loadedLiters: true, status: true } },
      },
    }),
    tx.distillation.count({ where: { lotId, type: DistillationType.DESTROZADO, status: DistillationStatus.ACTIVA } }),
  ]);
  const sourcesComplete = sources.length > 0 && sources.every((source) => {
    const sourceLiters = destrozadoProducedLiters(source);
    const allocatedDirect = source.derivedDistillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const received = source.receiverTransfer?.liters ?? 0;
    return sourceLiters - allocatedDirect - received <= EPSILON
      && source.derivedDistillations.every((run) => run.status === DistillationStatus.TERMINADA);
  });
  const receiversComplete = receivers.every((receiver) => {
    const stock = receiverTotals(receiver);
    return stock.receivedLiters > EPSILON
      && stock.availableLiters <= EPSILON
      && receiver.rectifications.length > 0
      && receiver.rectifications.filter((run) => run.status !== DistillationStatus.CANCELADA)
        .every((run) => run.status === DistillationStatus.TERMINADA);
  });
  const complete = activeDestrozados === 0 && sourcesComplete && receiversComplete;
  if (complete) await advanceLotStage(tx, lotId, LotStage.TERMINADO);
  return complete;
}

/**
 * Marca una tina como físicamente vacía, sin falsear el mosto original ni
 * los litros de destrozado registrados. Una diferencia pendiente conserva
 * su magnitud, actor y motivo en AuditEvent.
 */
export async function closeEmptyFermentationSource(input: {
  fermentationId: string;
  expectedLotId?: string;
  actorId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 12 || reason.length > 500) {
    throw new DistillationOperationError("Escribe un motivo de conciliación (mínimo 12 caracteres).", "REASON_REQUIRED");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Fermentation" WHERE "id" = ${input.fermentationId} FOR UPDATE`);
    const source = await tx.fermentation.findUnique({
      where: { id: input.fermentationId },
      include: {
        lot: { select: { stage: true, code: true } },
        distillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { id: true, loadedLiters: true, status: true },
        },
      },
    });
    if (!source || source.status !== "TERMINADA" || source.lot.stage === LotStage.TERMINADO ||
      (input.expectedLotId && input.expectedLotId !== source.lotId)) {
      throw new DistillationOperationError("No se puede conciliar esta tina o pertenece a otro lote.", "SOURCE_UNAVAILABLE");
    }
    if (source.distillations.some((run) => run.status === DistillationStatus.ACTIVA)) {
      throw new DistillationOperationError("Termina primero las corridas activas de esta tina.", "ACTIVE_RUNS");
    }
    const previous = await tx.auditEvent.findFirst({
      where: {
        entityType: "Fermentation",
        entityId: source.id,
        action: "FERMENTATION_SOURCE_EMPTIED",
      },
      select: { id: true },
    });
    if (previous) throw new DistillationOperationError("Esta tina ya fue conciliada.", "ALREADY_CLOSED");
    const loadedLiters = source.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const residualLiters = Math.max(0, source.mustLiters - loadedLiters);
    if (residualLiters <= EPSILON) {
      throw new DistillationOperationError("Esta tina ya no tiene saldo contable pendiente.", "NO_RESIDUAL");
    }
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "FERMENTATION_SOURCE_EMPTIED",
        entityType: "Fermentation",
        entityId: source.id,
        metadata: {
          reason,
          lotCode: source.lot.code,
          tank: source.tank,
          mustLiters: source.mustLiters,
          destrozadoLoadedLiters: loadedLiters,
          unregisteredResidualLiters: residualLiters,
          physicallyEmptyConfirmed: true,
        },
      },
    });
    await reconcileLotDistillationStage(tx, source.lotId, DistillationType.DESTROZADO);
    return { residualLiters, lotCode: source.lot.code, tank: source.tank };
  });
}

/**
 * Confirma que queda mosto real después de terminar destrozados previos.
 * La bitácora registra quién lo revisó y cuánto saldo contable había.
 */
export async function verifyFermentationSourceHasMust(input: {
  fermentationId: string;
  expectedLotId?: string;
  actorId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 12 || reason.length > 500) {
    throw new DistillationOperationError("Escribe una observación de verificación (mínimo 12 caracteres).", "REASON_REQUIRED");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Fermentation" WHERE "id" = ${input.fermentationId} FOR UPDATE`);
    const source = await tx.fermentation.findUnique({
      where: { id: input.fermentationId },
      include: {
        lot: { select: { stage: true, code: true } },
        distillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true, status: true },
        },
      },
    });
    if (!source || source.status !== "TERMINADA" || source.lot.stage === LotStage.TERMINADO ||
      (input.expectedLotId && input.expectedLotId !== source.lotId)) {
      throw new DistillationOperationError("No se puede verificar esta tina o pertenece a otro lote.", "SOURCE_UNAVAILABLE");
    }
    const alreadyClosed = await tx.auditEvent.findFirst({
      where: { entityType: "Fermentation", entityId: source.id, action: "FERMENTATION_SOURCE_EMPTIED" },
      select: { id: true },
    });
    if (alreadyClosed) throw new DistillationOperationError("La tina ya fue conciliada como vacía.", "SOURCE_CLOSED");
    const allocated = source.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const remaining = source.mustLiters - allocated;
    if (remaining <= EPSILON) throw new DistillationOperationError("No queda mosto contable pendiente.", "NO_RESIDUAL");
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "FERMENTATION_SOURCE_AVAILABLE",
        entityType: "Fermentation",
        entityId: source.id,
        metadata: { reason, lotCode: source.lot.code, tank: source.tank, ledgerAvailableLiters: remaining, physicalStockConfirmed: true },
      },
    });
    return { remaining };
  });
}

export async function getFermentationSourceDiscrepancies(lotId?: string) {
  const rows = await prisma.fermentation.findMany({
    where: { status: "TERMINADA", ...(lotId ? { lotId } : {}), lot: { stage: { not: LotStage.TERMINADO } } },
    include: {
      lot: { select: { code: true } },
      distillations: {
        where: { status: { not: DistillationStatus.CANCELADA } },
        select: { loadedLiters: true, status: true, finishedAt: true },
      },
    },
    orderBy: { finishedAt: "desc" },
  });
  if (!rows.length) return [];
  const events = await prisma.auditEvent.findMany({
    where: { entityType: "Fermentation", entityId: { in: rows.map((row) => row.id) },
      action: { in: ["FERMENTATION_SOURCE_EMPTIED", "FERMENTATION_SOURCE_AVAILABLE"] } },
    select: { action: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.flatMap((row) => {
    const allocated = row.distillations.reduce((sum, run) => sum + run.loadedLiters, 0);
    const remaining = row.mustLiters - allocated;
    const lastFinished = row.distillations
      .filter((run) => run.status === DistillationStatus.TERMINADA)
      .reduce((last, run) => run.finishedAt && run.finishedAt > last ? run.finishedAt : last, new Date(0));
    const sourceEvents = events.filter((event) => event.entityId === row.id);
    const closed = sourceEvents.some((event) => event.action === "FERMENTATION_SOURCE_EMPTIED");
    const verified = sourceEvents.find((event) => event.action === "FERMENTATION_SOURCE_AVAILABLE");
    if (remaining <= EPSILON || closed || !row.distillations.length ||
        row.distillations.some((run) => run.status === DistillationStatus.ACTIVA) ||
        (verified && verified.createdAt >= lastFinished)) return [];
    return [{ id: row.id, lotCode: row.lot.code, tank: row.tank, remainingLiters: remaining, allocatedLiters: allocated, originalLiters: row.mustLiters }];
  });
}
