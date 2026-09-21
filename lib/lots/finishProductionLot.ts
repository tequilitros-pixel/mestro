import "server-only";

import { randomUUID } from "crypto";
import { LotStage, Prisma, RawMaterialMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRawMaterialMovement } from "@/lib/liquors/rawMaterialMovements";
import { getLotFinalization } from "@/lib/lots/finalization";

export class FinishProductionLotError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "FinishProductionLotError";
  }
}

export async function finishProductionLot(input: {
  lotId: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Lot" WHERE "id" = ${input.lotId} FOR UPDATE`,
    );

    const lot = await tx.lot.findUnique({
      where: { id: input.lotId },
      select: {
        id: true,
        code: true,
        stage: true,
        finishedAt: true,
        totalLitersObtained: true,
        qrToken: true,
        distillations: {
          select: { type: true, status: true, finalLiters: true },
        },
      },
    });

    if (!lot) throw new FinishProductionLotError("LOT_NOT_FOUND");
    if (lot.finishedAt && lot.totalLitersObtained !== null) {
      return {
        alreadyFinished: true,
        totalLiters: lot.totalLitersObtained,
        qrToken: lot.qrToken,
      };
    }

    const readiness = getLotFinalization({
      stage: lot.stage,
      finishedAt: lot.finishedAt,
      totalLitersObtained: lot.totalLitersObtained,
      runs: lot.distillations,
    });
    if (!readiness.ready) {
      throw new FinishProductionLotError(readiness.reason);
    }

    const qrToken = lot.qrToken ?? randomUUID();
    await tx.lot.update({
      where: { id: lot.id },
      data: {
        stage: LotStage.TERMINADO,
        finishedAt: new Date(),
        totalLitersObtained: readiness.totalLiters,
        qrToken,
      },
    });

    const existingOutput = await tx.rawMaterialMovement.findFirst({
      where: {
        lotId: lot.id,
        type: RawMaterialMovementType.PRODUCCION,
      },
      select: { id: true },
    });
    const target = existingOutput
      ? null
      : await tx.rawMaterial.findFirst({
          where: { receivesLotOutput: true, active: true },
          select: { id: true },
        });

    if (target) {
      await applyRawMaterialMovement(tx, {
        rawMaterialId: target.id,
        type: RawMaterialMovementType.PRODUCCION,
        amount: readiness.totalLiters,
        lotId: lot.id,
        createdById: input.actorId,
        notes: `Destilado obtenido del lote ${lot.code}.`,
      });
    }

    return {
      alreadyFinished: false,
      totalLiters: readiness.totalLiters,
      qrToken,
    };
  });
}
