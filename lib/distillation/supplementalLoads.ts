import "server-only";
import { DistillationStatus, DistillationType, EquipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DistillationOperationError } from "@/lib/distillation/errors";
import {
  allocatedFermentationLiters, fermentationHasActiveLoad,
  fermentationHasCompletedLoad, fermentationLatestFinishedLoad, totalRunLoadedLiters,
} from "@/lib/distillation/loadLedger";

const EPSILON = 0.005;

/**
 * Añade mosto de otra tina al destrozado abierto, sin sobrescribir la carga
 * original ni perder la relación de litros con la tina de procedencia.
 * Ambas filas se bloquean y se verifican dentro de la misma transacción.
 */
export async function addSupplementalFermentationLoad(input: {
  distillationId: string;
  fermentationId: string;
  liters: number;
  actorId: string;
  idempotencyKey: string;
}) {
  if (!Number.isFinite(input.liters) || input.liters <= EPSILON) {
    throw new DistillationOperationError("Registra una carga adicional mayor a cero.", "INVALID_LITERS");
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 128) {
    throw new DistillationOperationError("La solicitud de carga no es válida.", "INVALID_OPERATION");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Distillation" WHERE "id" = ${input.distillationId} FOR UPDATE`);
    const previous = await tx.distillationSupplementalLoad.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (previous) {
      if (previous.distillationId !== input.distillationId || previous.fermentationId !== input.fermentationId
        || Math.abs(previous.liters - input.liters) > EPSILON) {
        throw new DistillationOperationError("La solicitud ya se utilizó con otros datos.", "DUPLICATE_OPERATION");
      }
      return { id: previous.id, duplicate: true };
    }
    const run = await tx.distillation.findUnique({
      where: { id: input.distillationId },
      include: {
        equipment: { select: { status: true, capacity: true, currentLoad: true } },
        supplementalLoads: { select: { liters: true } },
      },
    });
    if (!run || run.status !== DistillationStatus.ACTIVA || run.type !== DistillationType.DESTROZADO) {
      throw new DistillationOperationError("Solo puedes agregar mosto a un destrozado activo.", "RUN_NOT_ACTIVE");
    }
    if (run.equipment.status !== EquipmentStatus.OPERANDO) {
      throw new DistillationOperationError("El alambique no figura en operación.", "EQUIPMENT_NOT_OPERATING");
    }
    const total = totalRunLoadedLiters(run);
    const capacityLimit = run.equipment.capacity * (run.fillPercent ?? 100) / 100;
    if (total + input.liters - capacityLimit > EPSILON) {
      throw new DistillationOperationError(
        `No cabe esa carga. Capacidad autorizada: ${capacityLimit.toFixed(2)} L; cargados: ${total.toFixed(2)} L.`,
        "CAPACITY_EXCEEDED",
      );
    }
    if (Math.abs(run.equipment.currentLoad - total) > EPSILON) {
      throw new DistillationOperationError("La carga física y la bitácora no coinciden. Revisa el alambique.", "LOAD_DISCREPANCY");
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Fermentation" WHERE "id" = ${input.fermentationId} FOR UPDATE`);
    const source = await tx.fermentation.findUnique({
      where: { id: input.fermentationId },
      include: {
        distillations: {
          where: { status: { not: DistillationStatus.CANCELADA } },
          select: { loadedLiters: true, status: true, finishedAt: true },
        },
        supplementalLoads: {
          where: { distillation: { status: { not: DistillationStatus.CANCELADA } } },
          select: { liters: true, distillation: { select: { status: true, finishedAt: true } } },
        },
      },
    });
    if (!source || source.status !== "TERMINADA" || source.lotId !== run.lotId) {
      throw new DistillationOperationError("La tina no está terminada o no pertenece al mismo lote.", "SOURCE_UNAVAILABLE");
    }
    const emptied = await tx.auditEvent.findFirst({
      where: { entityType: "Fermentation", entityId: source.id, action: "FERMENTATION_SOURCE_EMPTIED" },
      select: { id: true },
    });
    if (emptied) throw new DistillationOperationError("La tina fue marcada como vacía.", "SOURCE_CLOSED");
    if (fermentationHasCompletedLoad(source) && !fermentationHasActiveLoad(source)) {
      const verified = await tx.auditEvent.findFirst({
        where: { entityType: "Fermentation", entityId: source.id, action: "FERMENTATION_SOURCE_AVAILABLE" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      if (!verified || verified.createdAt < fermentationLatestFinishedLoad(source)) {
        throw new DistillationOperationError(
          "Confirma primero que existe mosto físico en esta tina antes de volver a cargar.",
          "PHYSICAL_STOCK_NOT_CONFIRMED",
        );
      }
    }
    const available = source.mustLiters - allocatedFermentationLiters(source);
    if (input.liters - available > EPSILON) {
      throw new DistillationOperationError(
        `Solo quedan ${Math.max(0, available).toFixed(2)} L en esa tina.`, "SOURCE_OVERALLOCATED",
      );
    }
    const added = await tx.distillationSupplementalLoad.create({
      data: {
        distillationId: run.id,
        fermentationId: source.id,
        liters: input.liters,
        idempotencyKey: input.idempotencyKey,
        recordedById: input.actorId,
      },
    });
    await tx.equipment.update({
      where: { id: run.equipmentId },
      data: { currentLoad: { increment: input.liters } },
    });
    return { id: added.id, duplicate: false };
  });
}
