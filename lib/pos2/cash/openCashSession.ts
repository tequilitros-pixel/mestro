import "server-only";
import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActiveTerminal, requireActorBranch } from "./guards";

export async function openCashSession(input: {
  operationId: string;
  branchId: string;
  registerId: string;
  terminalId: string;
  actor: CommandActor;
  openingCash: string;
}) {
  let opening: Money;
  try { opening = Money.nonNegative(input.openingCash); } catch { throw new DomainError("VALIDATION_ERROR", { field: "openingCash" }); }
  const payload = { branchId: input.branchId, registerId: input.registerId, terminalId: input.terminalId, actorId: input.actor.id, openingCash: opening.toString() };
  return executeIdempotent({
    operationId: input.operationId, command: "OpenCashSession", payload,
    receiptContext: { actorId: input.actor.id, branchId: input.branchId },
    execute: async (tx) => {
      requireActorBranch(input.actor, input.branchId);
      await requireCapability(tx, input.actor, "cash.session.open", input.branchId);
      const register = await tx.register.findUnique({ where: { id: input.registerId } });
      if (!register || !register.active || register.branchId !== input.branchId) throw new DomainError("VALIDATION_ERROR", { field: "registerId" });
      await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: input.branchId });
      const session = await tx.cashSession.create({ data: {
        branchId: input.branchId, registerId: input.registerId, openingTerminalId: input.terminalId, openedById: input.actor.id,
      } });
      const declaration = await tx.cashDeclaration.create({ data: {
        cashSessionId: session.id, type: "OPENING", amount: opening.toDecimal(), actorId: input.actor.id, terminalId: input.terminalId,
      } });
      await tx.cashMovement.create({ data: {
        cashSessionId: session.id, branchId: input.branchId, registerId: input.registerId,
        type: "OPENING_FLOAT", direction: "IN", amount: opening.toDecimal(), sourceType: "CashDeclaration", sourceId: declaration.id,
        actorId: input.actor.id, operationId: input.operationId,
      } });
      await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, terminalId: input.terminalId, action: "cash.session.opened", entityType: "CashSession", entityId: session.id, operationId: input.operationId, metadata: { registerId: input.registerId, openingCash: opening.toString() } });
      await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, terminalId: input.terminalId, action: "cash.declaration.created", entityType: "CashDeclaration", entityId: declaration.id, operationId: input.operationId, metadata: { type: "OPENING", amount: opening.toString() } });
      await appendOutboxEvent(tx, { topic: "cash.session.opened", aggregate: "CashSession", aggregateId: session.id, operationId: input.operationId, payload: { sessionId: session.id, branchId: input.branchId, registerId: input.registerId } });
      return { type: "CashSession", id: session.id, status: session.status, openingCash: opening.toString() };
    },
  });
}
