import "server-only";
import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { appendOutboxEvent } from "@/lib/pos2/outbox";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { createEnvelopeForCashCut } from "@/lib/cash-cuts/safeEnvelopes";
import { calculateCashDifference, calculateExpectedCash } from "./domain";
import { lockCashSession, requireActiveTerminal, requireActorBranch } from "./guards";

export async function closeCashSession(input: {
  operationId: string;
  cashSessionId: string;
  terminalId: string;
  actor: CommandActor;
  declaredCash: string;
  envelopeAmount?: string;
}) {
  let declared: Money;
  let envelope: Money;
  try { declared = Money.nonNegative(input.declaredCash); envelope = Money.nonNegative(input.envelopeAmount ?? "0"); } catch { throw new DomainError("VALIDATION_ERROR", { field: "cash" }); }
  if (envelope.compare(declared) > 0) throw new DomainError("VALIDATION_ERROR", { field: "envelopeAmount" });
  const payload = { cashSessionId: input.cashSessionId, terminalId: input.terminalId, actorId: input.actor.id, declaredCash: declared.toString(), envelopeAmount: envelope.toString() };
  return executeIdempotent({ operationId: input.operationId, command: "CloseCashSession", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const session = await lockCashSession(tx, input.cashSessionId);
    requireActorBranch(input.actor, session.branchId);
    await requireCapability(tx, input.actor, "cash.session.close", session.branchId);
    await requireCapability(tx, input.actor, "cash.declaration.create", session.branchId);
    await requireActiveTerminal(tx, { terminalId: input.terminalId, branchId: session.branchId });
    if (session.status !== "OPEN") throw new DomainError("INVALID_STATE_TRANSITION", { status: session.status });
    const paymentPending = await tx.pos2Order.findFirst({ where: { cashSessionId: session.id, status: "PAYMENT_PENDING" }, select: { id: true, orderNumber: true } });
    if (paymentPending) throw new DomainError("ORDER_PAYMENT_PENDING", { orderId: paymentPending.id, orderNumber: paymentPending.orderNumber });
    await tx.cashSession.update({ where: { id: session.id }, data: { status: "CLOSING" } });
    const movements = await tx.cashMovement.findMany({ where: { cashSessionId: session.id }, select: { amount: true, direction: true, type: true } });
    const expected = calculateExpectedCash(movements.map((movement) => ({ amount: movement.amount.toString(), direction: movement.direction })));
    const difference = calculateCashDifference(declared.toString(), expected.toString());
    const declaration = await tx.cashDeclaration.create({ data: { cashSessionId: session.id, type: "CLOSING", amount: declared.toDecimal(), actorId: input.actor.id, terminalId: input.terminalId } });
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: session.branchId }, select: { code: true } });
    const opening = movements.find((movement) => movement.type === "OPENING_FLOAT")?.amount ?? Money.zero().toDecimal();
    const cashIn = movements.filter((movement) => movement.type === "CASH_IN").reduce((sum, movement) => sum.add(Money.from(movement.amount)), Money.zero());
    const cashOut = movements.filter((movement) => movement.type === "CASH_OUT").reduce((sum, movement) => sum.add(Money.from(movement.amount)), Money.zero());
    const cashSales = movements.filter((movement) => movement.type === "SALE_CASH").reduce((sum, movement) => sum.add(Money.from(movement.amount)), Money.zero());
    const closedAt = new Date();
    const cutDate = new Date(Date.UTC(closedAt.getUTCFullYear(), closedAt.getUTCMonth(), closedAt.getUTCDate()));
    const cashCut = await tx.cashCut.create({ data: {
      code: `CC2-${branch.code}-${session.id}`,
      branchId: session.branchId, responsibleId: session.openedById, date: cutDate, openedAt: session.openedAt, closedAt,
      status: "CERRADO", startingFund: Number(opening.toString()), cashCounted: Number(declared.toString()), cashExpected: Number(expected.toString()), difference: Number(difference.toString()),
      envelopeAmount: Number(envelope.toString()), nextFund: Number(declared.subtract(envelope).toString()), totalSales: Number(cashSales.toString()), totalInflows: Number(cashIn.toString()), totalOutflows: Number(cashOut.toString()),
      createdById: session.openedById, updatedById: input.actor.id,
      auditEntries: { create: { action: "CREADO_DESDE_CASH_SESSION_V2", userId: input.actor.id, newValue: `cashSessionId: ${session.id}; diferencia: ${difference.toString()}` } },
    } });
    if (envelope.compare(Money.zero()) > 0) await createEnvelopeForCashCut(tx, { cashCutId: cashCut.id, branchId: session.branchId, branchCode: branch.code, cutDate, amount: Number(envelope.toString()), userId: input.actor.id });
    await tx.cashSession.update({ where: { id: session.id }, data: { status: "CLOSED", closingTerminalId: input.terminalId, closedById: input.actor.id, closedAt, expectedCash: expected.toDecimal(), difference: difference.toDecimal(), cashCutId: cashCut.id } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: session.branchId, terminalId: input.terminalId, action: "cash.declaration.created", entityType: "CashDeclaration", entityId: declaration.id, operationId: input.operationId, metadata: { type: "CLOSING", amount: declared.toString() } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: session.branchId, terminalId: input.terminalId, action: "cash.session.closed", entityType: "CashSession", entityId: session.id, operationId: input.operationId, metadata: { expected: expected.toString(), declared: declared.toString(), difference: difference.toString(), cashCutId: cashCut.id } });
    await appendOutboxEvent(tx, { topic: "cash.session.closed", aggregate: "CashSession", aggregateId: session.id, operationId: input.operationId, payload: { sessionId: session.id, cashCutId: cashCut.id, expected: expected.toString(), declared: declared.toString(), difference: difference.toString() } });
    return { type: "CashSession", id: session.id, status: "CLOSED", cashCutId: cashCut.id, expectedCash: expected.toString(), declaredCash: declared.toString(), difference: difference.toString() };
  } });
}
