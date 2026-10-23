import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/errors";

export async function withOpenCashCutWrite<T>(cashCutId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const cuts = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "CashCut" WHERE "id" = ${cashCutId} FOR UPDATE
    `;
    if (cuts[0]?.status !== "ABIERTO") throw new DomainError("CASH_SESSION_NOT_OPEN", { cashCutId });
    return write(tx);
  });
}
