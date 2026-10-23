import type { Prisma } from "@prisma/client";

type DatabaseRole = { current_user: string; rolsuper: boolean; rolbypassrls: boolean };

export async function enforceRuntimeRole(tx: Prisma.TransactionClient, production: boolean) {
  const read = async () => (await tx.$queryRaw<DatabaseRole[]>`
    SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `)[0];
  const reject = (role: DatabaseRole | undefined): never => {
    console.error("RUNTIME_DATABASE_ROLE_REJECTED", role ?? { missing: true });
    throw new Error("RUNTIME_DATABASE_ROLE_MUST_ENFORCE_RLS");
  };
  let role = await read();
  // Never turn an owner/bypass connection into an accepted runtime connection.
  if (!role || role.rolsuper || role.rolbypassrls) reject(role);
  if (production && role!.current_user !== "maestro_runtime") {
    // Transaction-local, fixed role: works even when a host drops startup options.
    // PostgreSQL independently requires the LOGIN principal's SET membership.
    await tx.$executeRaw`SET LOCAL ROLE maestro_runtime`;
    role = await read();
  }
  if (!role || role.rolsuper || role.rolbypassrls || (production && role.current_user !== "maestro_runtime")) reject(role);
}
