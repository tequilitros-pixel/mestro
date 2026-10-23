import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function appendOutboxEvent(
  tx: Prisma.TransactionClient,
  event: {
    topic: string;
    aggregate: string;
    aggregateId: string;
    operationId?: string;
    payload: Prisma.InputJsonValue;
  },
) {
  return tx.outboxEvent.create({ data: event });
}

export async function processNextOutboxEvent(
  handler: (event: { id: string; topic: string; payload: Prisma.JsonValue }) => Promise<void>,
) {
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OutboxEvent"
      WHERE "status" IN ('PENDING', 'FAILED')
        AND "availableAt" <= NOW()
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return tx.outboxEvent.update({
      where: { id: rows[0].id },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
      select: { id: true, topic: true, payload: true },
    });
  });

  if (!claimed) return false;
  try {
    await handler(claimed);
    await prisma.outboxEvent.update({ where: { id: claimed.id }, data: { status: "PROCESSED", processedAt: new Date() } });
  } catch (error) {
    await prisma.outboxEvent.update({
      where: { id: claimed.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" },
    });
    throw error;
  }
  return true;
}
