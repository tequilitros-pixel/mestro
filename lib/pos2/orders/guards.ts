import "server-only";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";

export async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Pos2Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (!rows[0]) throw new DomainError("ORDER_NOT_FOUND", { orderId });
  return tx.pos2Order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: { orderBy: { position: "asc" } } } });
}

export function requireExpectedVersion(order: { id: string; version: number }, expectedVersion: number) {
  if (!Number.isInteger(expectedVersion) || order.version !== expectedVersion) throw new DomainError("ORDER_VERSION_CONFLICT", { orderId: order.id, expectedVersion, actualVersion: order.version });
}

export function requireOpenOrder(order: { id: string; status: string }) {
  if (order.status === "PAYMENT_PENDING") throw new DomainError("ORDER_PAYMENT_PENDING", { orderId: order.id });
  if (order.status === "FINALIZED") throw new DomainError("ORDER_ALREADY_FINALIZED", { orderId: order.id });
  if (order.status !== "OPEN") throw new DomainError("ORDER_NOT_OPEN", { orderId: order.id, status: order.status });
}
