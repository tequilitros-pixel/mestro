import { Prisma } from "@prisma/client";

/**
 * A physical count is a snapshot at `countedAt`, not necessarily the instant
 * when its draft is closed. Keep movements posted after that snapshot in the
 * operational balance.
 */
export function calculateCountCutoverBalance(input: {
  currentBalance: Prisma.Decimal;
  countedQuantity: Prisma.Decimal;
  postCaptureDelta: Prisma.Decimal;
}) {
  const balanceAfter = input.countedQuantity.plus(input.postCaptureDelta);

  return {
    balanceAfter,
    correctionDelta: balanceAfter.minus(input.currentBalance),
  };
}
