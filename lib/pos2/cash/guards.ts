import "server-only";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import type { CommandActor } from "@/lib/pos2/authorization";
import { requirePos2ContextEnabled } from "@/lib/pos2/certification/rollout";

export async function requireActiveTerminal(
  tx: Prisma.TransactionClient,
  input: { terminalId: string; branchId: string },
) {
  const terminal = await tx.terminal.findUnique({ where: { id: input.terminalId } });
  if (!terminal || terminal.status !== "ACTIVE" || terminal.branchId !== input.branchId || !terminal.credentialHash) {
    throw new DomainError("PERMISSION_DENIED", { terminalId: input.terminalId });
  }
  return terminal;
}

export function requireActorBranch(actor: CommandActor, branchId: string) {
  if (actor.branchIds !== null && !actor.branchIds.includes(branchId)) {
    throw new DomainError("PERMISSION_DENIED", { branchId });
  }
}

export async function lockCashSession(tx: Prisma.TransactionClient, sessionId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CashSession" WHERE "id" = ${sessionId} FOR UPDATE
  `;
  if (!rows[0]) throw new DomainError("VALIDATION_ERROR", { field: "cashSessionId" }, "La sesión de caja no existe.");
  const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
  requirePos2ContextEnabled(session.branchId, session.registerId);
  return session;
}
