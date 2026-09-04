import "server-only";
import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { sanitizeAuditMetadata } from "@/lib/pos2/auditMetadata";
import { lockCashSession, requireActiveTerminal, requireActorBranch } from "./guards";

type Input = { operationId: string; cashSessionId: string; terminalId: string; actor: CommandActor; amount: string; reason: string; metadata?: Record<string, unknown> };

async function create(input: Input, kind: "CASH_IN" | "CASH_OUT") {
  let amount: Money;
  try { amount = Money.nonNegative(input.amount); } catch { throw new DomainError("VALIDATION_ERROR", { field: "amount" }); }
  if (amount.equals(Money.zero()) || !input.reason.trim()) throw new DomainError("VALIDATION_ERROR", { field: "amountOrReason" });
  const capability = kind === "CASH_IN" ? "cash.in.create" : "cash.out.create";
  const payload = { cashSessionId: input.cashSessionId, terminalId: input.terminalId, actorId: input.actor.id, amount: amount.toString(), reason: input.reason.trim(), kind };
  return executeIdempotent({ operationId: input.operationId, command: kind === "CASH_IN" ? "CreateCashIn" : "CreateCashOut", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const session = await lockCashSession(tx, input.cashSessionId);
    requireActorBranch(input.actor, session.branchId);
    await requireCapability(tx, input.actor, capability, session.branchId);
    await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: session.branchId });
    if (session.status !== "OPEN") throw new DomainError("INVALID_STATE_TRANSITION", { status: session.status });
    const movement = await tx.cashMovement.create({ data: {
      cashSessionId: session.id, branchId: session.branchId, registerId: session.registerId, type: kind,
      direction: kind === "CASH_IN" ? "IN" : "OUT", amount: amount.toDecimal(), sourceType: "Manual", sourceId: input.operationId,
      actorId: input.actor.id, operationId: input.operationId, metadata: sanitizeAuditMetadata({ reason: input.reason.trim(), ...input.metadata }),
    } });
    const action = kind === "CASH_IN" ? "cash.in.created" : "cash.out.created";
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: session.branchId, terminalId: input.terminalId, action, entityType: "CashMovement", entityId: movement.id, operationId: input.operationId, metadata: { sessionId: session.id, amount: amount.toString(), reason: input.reason.trim() } });
    await appendOutboxEvent(tx, { topic: action, aggregate: "CashSession", aggregateId: session.id, operationId: input.operationId, payload: { movementId: movement.id, sessionId: session.id, amount: amount.toString() } });
    return { type: "CashMovement", id: movement.id, cashSessionId: session.id, movementType: kind, amount: amount.toString() };
  } });
}

export const createCashIn = (input: Input) => create(input, "CASH_IN");
export const createCashOut = (input: Input) => create(input, "CASH_OUT");
