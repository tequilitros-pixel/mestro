import type { Prisma } from "@prisma/client";

export type IdentityActor = { id: string; role: string };
export type IdentityChange = {
  target: "EMPLOYEE" | "USER";
  active: boolean;
  employeeId?: string;
  userId?: string;
  expectedActive?: boolean;
  reason?: string;
};
export type IdentityTx = Pick<Prisma.TransactionClient, "user" | "employee" | "userSession">;
export class IdentityChangeError extends Error {}

type Dependencies = {
  authorizeContext: (actor: IdentityActor) => Promise<void>;
  revokeSessions: (userId: string) => Promise<number>;
};

// Called only inside the service transaction. Employment and financial delegates
// are deliberately absent from this interface.
export async function applyIdentityChange(
  tx: IdentityTx,
  actor: IdentityActor,
  input: IdentityChange,
  dependencies: Dependencies,
) {
  if (!actor.id || actor.role !== "ADMIN") throw new IdentityChangeError("Solo ADMIN puede administrar identidades.");
  if (!["EMPLOYEE", "USER"].includes(input.target) || typeof input.active !== "boolean"
    || (input.expectedActive !== undefined && typeof input.expectedActive !== "boolean")) {
    throw new IdentityChangeError("Estado de identidad no valido.");
  }
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > 500) throw new IdentityChangeError("El motivo no puede superar 500 caracteres.");
  const administrator = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, active: true } });
  if (!administrator?.active || administrator.role !== "ADMIN") throw new IdentityChangeError("Solo ADMIN activo puede administrar identidades.");
  await dependencies.authorizeContext(administrator);

  const employee = input.employeeId ? await tx.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, active: true, userId: true, user: { select: { id: true, active: true } } },
  }) : null;
  if ((input.employeeId || input.target === "EMPLOYEE") && !employee) throw new IdentityChangeError("Empleado no encontrado.");
  const user = input.target === "USER" && input.userId
    ? await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, active: true } })
    : employee?.user ?? null;
  if (input.target === "USER" && (!input.userId || !user)) throw new IdentityChangeError("Usuario no encontrado.");
  if (input.target === "USER" && employee && employee.userId !== user?.id) {
    throw new IdentityChangeError("El usuario vinculado cambio. Recarga la ficha.");
  }
  if (input.target === "USER" && !input.active && user!.id === administrator.id) {
    throw new IdentityChangeError("No puedes deshabilitar tu propio acceso.");
  }

  const before = input.target === "EMPLOYEE" ? employee!.active : user!.active;
  const changed = before !== input.active;
  if (changed && input.expectedActive !== undefined && before !== input.expectedActive) {
    throw new IdentityChangeError("El estado cambio. Recarga la ficha antes de continuar.");
  }
  if (changed) {
    if (input.target === "EMPLOYEE") {
      await tx.employee.update({ where: { id: employee!.id }, data: { active: input.active } });
    } else {
      await tx.user.update({ where: { id: user!.id }, data: { active: input.active } });
    }
  }
  const revokedSessions = input.target === "USER" && !input.active
    ? await dependencies.revokeSessions(user!.id) : 0;
  return {
    changed,
    revokedSessions,
    snapshot: {
      employeeId: employee?.id ?? null,
      employeeActive: input.target === "EMPLOYEE" ? input.active : employee?.active ?? null,
      userId: user?.id ?? null,
      userActive: input.target === "USER" ? input.active : user?.active ?? null,
    },
    audit: {
      actorId: administrator.id,
      action: `${input.target}_${input.active ? "ENABLED" : "DISABLED"}`,
      employeeId: employee?.id ?? null,
      userId: user?.id ?? null,
      before,
      after: input.active,
      reason,
      revokedSessions,
    },
  };
}
