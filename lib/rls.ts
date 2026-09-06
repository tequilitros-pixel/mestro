import "server-only";

import type { Prisma } from "@prisma/client";
import { rawPrisma as prisma } from "@/lib/prisma";

export type RlsUser = { id: string; role: string };

export async function setRlsContext(tx: Prisma.TransactionClient, user: RlsUser | null) {
  const [role] = await tx.$queryRaw<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  if (!role || role.rolsuper || role.rolbypassrls || (process.env.NODE_ENV === "production" && role.current_user !== "maestro_runtime")) throw new Error("RUNTIME_DATABASE_ROLE_MUST_ENFORCE_RLS");
  const identity = user ? await tx.user.findUnique({ where: { id: user.id }, select: { active: true, role: true } }) : null;
  const active = Boolean(identity?.active);
  await tx.$queryRaw`
    SELECT
      set_config('app.current_user_id', ${active ? user!.id : ""}, true),
      set_config('app.is_admin', ${String(active && user?.role === "ADMIN" && identity?.role === "ADMIN")}, true)
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
