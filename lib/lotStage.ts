import { LotStage, Prisma } from "@prisma/client";

/**
 * ==========================================================
 * MAESTRO
 * ----------------------------------------------------------
 * Avance de etapa de un Lote (Lot.stage).
 *
 * El campo Lot.stage debe reflejar la etapa más avanzada por
 * la que ya pasó el lote (RECEPCION → COCCION → MOLIENDA →
 * FERMENTACION → DESTILACION → RECTIFICACION → TERMINADO).
 *
 * `advanceLotStage` solo mueve la etapa hacia adelante: si el
 * lote ya está en una etapa igual o posterior a `targetStage`,
 * no hace nada. Esto evita que dos acciones concurrentes (o un
 * registro fuera de orden) hagan retroceder el estado del lote.
 * ==========================================================
 */

const STAGE_ORDER: LotStage[] = [
  LotStage.RECEPCION,
  LotStage.COCCION,
  LotStage.MOLIENDA,
  LotStage.FERMENTACION,
  LotStage.DESTILACION,
  LotStage.RECTIFICACION,
  LotStage.TERMINADO,
];

type PrismaClientOrTransaction =
  | Prisma.TransactionClient
  | typeof import("@/lib/prisma").prisma;

export async function advanceLotStage(
  client: PrismaClientOrTransaction,
  lotId: string,
  targetStage: LotStage
) {
  const lot = await client.lot.findUnique({
    where: { id: lotId },
    select: { stage: true },
  });

  if (!lot) return;

  const currentIndex = STAGE_ORDER.indexOf(lot.stage);
  const targetIndex = STAGE_ORDER.indexOf(targetStage);

  if (targetIndex <= currentIndex) return;

  await client.lot.update({
    where: { id: lotId },
    data: { stage: targetStage },
  });
}
