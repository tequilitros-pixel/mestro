import "server-only";
import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { calculateCashDifference } from "./domain";
import { lockCashSession, requireActiveTerminal, requireActorBranch } from "./guards";

export async function recountCash(input: { operationId: string; cashSessionId: string; terminalId: string; actor: CommandActor; declaredCash: string; reason: string }) {
  let declared: Money;
  try { declared = Money.nonNegative(input.declaredCash); } catch { throw new DomainError("VALIDATION_ERROR", { field: "declaredCash" }); }
  if (!input.reason.trim()) throw new DomainError("VALIDATION_ERROR", { field: "reason" });
  const payload = { cashSessionId: input.cashSessionId, terminalId: input.terminalId, actorId: input.actor.id, declaredCash: declared.toString(), reason: input.reason.trim() };
  return executeIdempotent({ operationId: input.operationId, command: "RecountCash", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const session = await lockCashSession(tx, input.cashSessionId);
    requireActorBranch(input.actor, session.branchId);
    await requireCapability(tx, input.actor, "cash.recount", session.branchId);
    await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: session.branchId });
    if (session.status !== "CLOSED" || !session.expectedCash || !session.cashCutId) throw new DomainError("INVALID_STATE_TRANSITION", { status: session.status });
    const previous = await tx.cashDeclaration.findFirst({ where: { cashSessionId: session.id, type: { in: ["CLOSING", "RECOUNT"] } }, orderBy: { createdAt: "desc" } });
    if (!previous) throw new DomainError("CONFLICT");
    const difference = calculateCashDifference(declared.toString(), session.expectedCash.toString());
    const declaration = await tx.cashDeclaration.create({ data: { cashSessionId: session.id, type: "RECOUNT", amount: declared.toDecimal(), actorId: input.actor.id, terminalId: input.terminalId, reason: input.reason.trim(), supersedesId: previous.id } });
    await tx.cashSession.update({ where: { id: session.id }, data: { difference: difference.toDecimal() } });
    await tx.cashCut.update({ where: { id: session.cashCutId }, data: { cashCounted: Number(declared.toString()), difference: Number(difference.toString()), updatedById: input.actor.id, auditEntries: { create: { action: "RECUENTO_CASH_SESSION_V2", userId: input.actor.id, oldValue: previous.amount.toString(), newValue: declared.toString() } } } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: session.branchId, terminalId: input.terminalId, action: "cash.recount.created", entityType: "CashDeclaration", entityId: declaration.id, operationId: input.operationId, metadata: { sessionId: session.id, previousDeclarationId: previous.id, amount: declared.toString(), difference: difference.toString(), reason: input.reason.trim() } });
    await appendOutboxEvent(tx, { topic: "cash.recount.created", aggregate: "CashSession", aggregateId: session.id, operationId: input.operationId, payload: { sessionId: session.id, declarationId: declaration.id, difference: difference.toString() } });
    return { type: "CashDeclaration", id: declaration.id, cashSessionId: session.id, declaredCash: declared.toString(), difference: difference.toString() };
  } });
}
