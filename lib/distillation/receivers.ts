import "server-only";

import {
  DistillationReceiverStatus,
  DistillationStatus,
  DistillationType,
  EquipmentStatus,
  LotStage,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DistillationOperationError } from "@/lib/distillation/errors";
import { advanceLotStage } from "@/lib/lotStage";
import { receiverTotals } from "@/lib/distillation/receiverMath";
export { receiverTotals } from "@/lib/distillation/receiverMath";

const EPSILON = 0.005;

export function destrozadoProducedLiters(run: {
  finalHeartLiters: number | null;
  finalLiters: number | null;
}) {
  return run.finalHeartLiters && run.finalHeartLiters > 0
    ? run.finalHeartLiters
    : run.finalLiters ?? 0;
}

/** Safe for both retroactive allocations and automatically on closing a run. */
export async function transferDestrozadoToReceiver(
  tx: Prisma.TransactionClient,
  input: { receiverId: string; distillationId: string },
) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DistillationReceiver" WHERE "id" = ${input.receiverId} FOR UPDATE`);
  const receiver = await tx.distillationReceiver.findUnique({
    where: { id: input.receiverId },
    include: { transfers: true, rectifications: { select: { loadedLiters: true, status: true } } },
  });
  if (!receiver || receiver.status !== DistillationReceiverStatus.OPEN) {
    throw new DistillationOperationError("El tanque no está recibiendo destrozado.", "RECEIVER_NOT_OPEN");
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Distillation" WHERE "id" = ${input.distillationId} FOR UPDATE`);
  const run = await tx.distillation.findUnique({
    where: { id: input.distillationId },
    include: {
      receiverTransfer: true,
      derivedDistillations: { where: { status: { not: DistillationStatus.CANCELADA } }, select: { id: true } },
    },
  });
  if (!run || run.type !== DistillationType.DESTROZADO || run.status !== DistillationStatus.TERMINADA) {
    throw new DistillationOperationError("Solo puedes recibir destrozados terminados.", "INVALID_RUN");
  }
  if (run.lotId !== receiver.lotId) {
    throw new DistillationOperationError("No puedes mezclar destrozados de lotes distintos.", "DIFFERENT_LOT");
  }
  if (run.receiverTransfer) {
    if (run.receiverTransfer.receiverId === receiver.id) return run.receiverTransfer;
    throw new DistillationOperationError("Este destrozado ya está asignado a otro tanque.", "ALREADY_TRANSFERRED");
  }
  if (run.derivedDistillations.length > 0) {
    throw new DistillationOperationError("El destrozado ya se utilizó en una rectificación.", "ALREADY_CONSUMED");
  }
  const liters = destrozadoProducedLiters(run);
  if (!Number.isFinite(liters) || liters <= EPSILON) {
    throw new DistillationOperationError("El destrozado no tiene litros finales aprovechables.", "NO_OUTPUT");
  }
  const stock = receiverTotals(receiver);
  if (stock.availableLiters + liters - receiver.capacityLiters > EPSILON) {
    throw new DistillationOperationError("La descarga supera la capacidad del tanque receptor.", "RECEIVER_CAPACITY");
  }
  return tx.distillationReceiverTransfer.create({
    data: { receiverId: receiver.id, distillationId: run.id, liters, alcohol: run.finalAlcohol },
  });
}

export async function registerReceiver(input: { lotId: string; name: string; capacityLiters: number }) {
  const name = input.name.trim();
  if (!name || name.length > 80 || !Number.isFinite(input.capacityLiters) || input.capacityLiters <= 0) {
    throw new DistillationOperationError("Indica nombre y capacidad positiva del tanque.", "INVALID_RECEIVER");
  }
  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: input.lotId }, select: { id: true } });
    if (!lot) throw new DistillationOperationError("El lote no existe.", "INVALID_LOT");
    // A physical tank cannot concurrently be used by an open receiver from another lot.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${name}))::text AS "lock"`);
    const assignments = await tx.distillationReceiver.findMany({
      where: { name, status: { in: [DistillationReceiverStatus.OPEN, DistillationReceiverStatus.READY] } },
      include: {
        transfers: true,
        rectifications: { select: { loadedLiters: true, status: true } },
      },
    });
    const occupied = assignments.some((assignment) =>
      assignment.status === DistillationReceiverStatus.OPEN
      || receiverTotals(assignment).availableLiters > EPSILON
    );
    if (occupied) throw new DistillationOperationError("Ese tanque todavía contiene destrozado de otro lote.", "TANK_BUSY");
    return tx.distillationReceiver.create({ data: { lotId: input.lotId, name, capacityLiters: input.capacityLiters } });
  });
}

export async function receiveExistingDestrozado(input: { receiverId: string; distillationId: string }) {
  return prisma.$transaction((tx) => transferDestrozadoToReceiver(tx, input));
}

export async function sealReceiver(receiverId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DistillationReceiver" WHERE "id" = ${receiverId} FOR UPDATE`);
    const receiver = await tx.distillationReceiver.findUnique({
      where: { id: receiverId },
      include: { transfers: true, plannedRuns: { where: { status: DistillationStatus.ACTIVA }, select: { id: true } } },
    });
    if (!receiver || receiver.status !== DistillationReceiverStatus.OPEN) {
      throw new DistillationOperationError("El tanque ya no está abierto.", "RECEIVER_CLOSED");
    }
    if (!receiver.transfers.length) {
      throw new DistillationOperationError("No hay destrozado acumulado.", "RECEIVER_EMPTY");
    }
    if (receiver.plannedRuns.length) {
      throw new DistillationOperationError("Todavía hay alambiques activos destinados a este tanque.", "RUNS_ACTIVE");
    }
    return tx.distillationReceiver.update({
      where: { id: receiverId },
      data: { status: DistillationReceiverStatus.READY, readyAt: new Date() },
    });
  });
}

/**
 * Prepare a fresh reception cycle for the SAME PHYSICAL tank once empty.
 * Every cycle has its own immutable transfers and rectification lineage.
 */
export async function reuseEmptyReceiver(receiverId: string) {
  const previous = await prisma.distillationReceiver.findUnique({
    where: { id: receiverId },
    include: {
      transfers: true,
      rectifications: { select: { loadedLiters: true, status: true } },
    },
  });
  if (!previous || previous.status !== DistillationReceiverStatus.READY) {
    throw new DistillationOperationError("Primero debes terminar de recibir y vaciar el tanque.", "RECEIVER_NOT_READY");
  }
  if (receiverTotals(previous).availableLiters > EPSILON) {
    throw new DistillationOperationError("Todavía quedan litros en el tanque receptor.", "RECEIVER_NOT_EMPTY");
  }
  return registerReceiver({
    lotId: previous.lotId,
    name: previous.name,
    capacityLiters: previous.capacityLiters,
  });
}

type PairCharge = { equipmentId: string; liters: number };

/**
 * Two rectification runs draw from the SAME receptor. Both alambiques are
 * reserved, or none is. A full split instantly releases the physical tank.
 */
export async function startPairRectification(input: {
  receiverId: string;
  first: PairCharge;
  second: PairCharge;
  fillPercent?: number;
}) {
  const fillPercent = input.fillPercent ?? 80;
  const ids = [input.first.equipmentId, input.second.equipmentId];
  const liters = [input.first.liters, input.second.liters];
  if (!input.receiverId || ids.some((id) => !id) || ids[0] === ids[1]) {
    throw new DistillationOperationError("Selecciona dos alambiques diferentes.", "INVALID_EQUIPMENT");
  }
  if (!Number.isFinite(fillPercent) || fillPercent <= 0 || fillPercent > 100 ||
    liters.some((value) => !Number.isFinite(value) || value <= EPSILON || Math.abs(Math.round(value * 100) - value * 100) > 0.000001)) {
    throw new DistillationOperationError("Revisa los litros y el porcentaje de carga.", "INVALID_LOAD");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DistillationReceiver" WHERE "id" = ${input.receiverId} FOR UPDATE`);
    const receiver = await tx.distillationReceiver.findUnique({
      where: { id: input.receiverId },
      include: {
        transfers: true,
        rectifications: { select: { loadedLiters: true, status: true } },
      },
    });
    if (!receiver || receiver.status !== DistillationReceiverStatus.READY) {
      throw new DistillationOperationError("Primero cierra la recepción del tanque.", "RECEIVER_NOT_READY");
    }
    const stock = receiverTotals(receiver);
    if (liters[0] + liters[1] - stock.availableLiters > EPSILON) {
      throw new DistillationOperationError(
        `Hay ${stock.availableLiters.toFixed(2)} litros disponibles en el receptor.`,
        "RECEIVER_OVERALLOCATED",
      );
    }

    // Stable lock order avoids lock inversion with simultaneous operators.
    const sortedIds = [...ids].sort();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Equipment" WHERE "id" IN (${Prisma.join(sortedIds)}) ORDER BY "id" FOR UPDATE`);
    const equipments = await tx.equipment.findMany({
      where: { id: { in: ids }, type: "ALAMBIQUE", active: true },
      select: { id: true, capacity: true, status: true },
    });
    for (let index = 0; index < 2; index += 1) {
      const equipment = equipments.find((item) => item.id === ids[index]);
      if (!equipment || equipment.status !== EquipmentStatus.DISPONIBLE) {
        throw new DistillationOperationError("Uno de los alambiques está ocupado o fuera de servicio.", "EQUIPMENT_BUSY");
      }
      if (liters[index] - equipment.capacity * fillPercent / 100 > EPSILON) {
        throw new DistillationOperationError(
          `La carga del alambique ${index + 1} supera la capacidad permitida al ${fillPercent}%.`,
          "CAPACITY_EXCEEDED",
        );
      }
    }

    const runs = [];
    for (let index = 0; index < 2; index += 1) {
      const reserved = await tx.equipment.updateMany({
        where: { id: ids[index], status: EquipmentStatus.DISPONIBLE },
        data: { status: EquipmentStatus.OPERANDO, currentLoad: liters[index] },
      });
      if (reserved.count !== 1) {
        throw new DistillationOperationError("Uno de los alambiques acaba de ocuparse.", "EQUIPMENT_BUSY");
      }
      const run = await tx.distillation.create({
        data: {
          lotId: receiver.lotId,
          equipmentId: ids[index],
          type: DistillationType.RECTIFICACION,
          sourceReceiverId: receiver.id,
          loadedLiters: liters[index],
          fillPercent,
          initialAlcohol: stock.initialAlcohol,
        },
      });
      runs.push(run);
    }
    await advanceLotStage(tx, receiver.lotId, LotStage.RECTIFICACION);
    return runs;
  });
}
