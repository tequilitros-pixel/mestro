import "server-only";

import {
  DistillationReceiverStatus,
  DistillationStatus,
  DistillationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DistillationOperationError } from "@/lib/distillation/errors";

const EPSILON = 0.005;

export function destrozadoProducedLiters(run: {
  finalHeartLiters: number | null;
  finalLiters: number | null;
}) {
  return run.finalHeartLiters && run.finalHeartLiters > 0
    ? run.finalHeartLiters
    : run.finalLiters ?? 0;
}

/** The stock and ABV are derived from real transfers, never edited by hand. */
export function receiverTotals(receiver: {
  transfers: { liters: number; alcohol: number | null }[];
  rectifications: { loadedLiters: number; status: DistillationStatus }[];
}) {
  const receivedLiters = receiver.transfers.reduce((sum, item) => sum + item.liters, 0);
  const allocatedLiters = receiver.rectifications
    .filter((item) => item.status !== DistillationStatus.CANCELADA)
    .reduce((sum, item) => sum + item.loadedLiters, 0);
  const allMeasured = receiver.transfers.every((item) => item.alcohol !== null);
  const initialAlcohol = receivedLiters > 0 && allMeasured
    ? receiver.transfers.reduce((sum, item) => sum + item.liters * (item.alcohol ?? 0), 0) / receivedLiters
    : null;
  return { receivedLiters, allocatedLiters, availableLiters: Math.max(0, receivedLiters - allocatedLiters), initialAlcohol };
}

/** Safe for both retroactive allocations and automatically on closing a run. */
export async function transferDestrozadoToReceiver(
  tx: Prisma.TransactionClient,
  input: { receiverId: string; distillationId: string },
) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DistillationReceiver" WHERE "id" = ${input.receiverId} FOR UPDATE`);
  const receiver = await tx.distillationReceiver.findUnique({
    where: { id: input.receiverId },
    include: { transfers: true },
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
  const receivedLiters = receiver.transfers.reduce((sum, item) => sum + item.liters, 0);
  if (receivedLiters + liters - receiver.capacityLiters > EPSILON) {
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
