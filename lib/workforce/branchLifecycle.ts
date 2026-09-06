import "server-only";
import type { Prisma } from "@prisma/client";

/** Lock against concurrent deactivation until the new operation commits. */
export async function assertActiveBranch(tx: Prisma.TransactionClient, branchId: string) {
  const rows = await tx.$queryRaw<{ active: boolean }[]>`
    SELECT active FROM "Branch" WHERE id = ${branchId} FOR SHARE
  `;
  if (!rows[0]?.active) throw new Error("INACTIVE_OR_UNAUTHORIZED_BRANCH");
}
