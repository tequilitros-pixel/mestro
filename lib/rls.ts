import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RlsUser = { id: string; role: string };

export async function setRlsContext(tx: Prisma.TransactionClient, user: RlsUser) {
  await tx.$queryRaw`
    SELECT
      set_config('app.current_user_id', ${user.id}, true),
      set_config('app.is_admin', ${String(user.role === "ADMIN")}, true)
  `;
}

export async function withRlsContext<T>(
  user: RlsUser,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await setRlsContext(tx, user);
    return operation(tx);
  });
}
