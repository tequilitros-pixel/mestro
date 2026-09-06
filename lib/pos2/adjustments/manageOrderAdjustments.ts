import "server-only";
import { Prisma, type AdjustmentKind } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { lockOrder, requireExpectedVersion, requireOpenOrder } from "@/lib/pos2/orders/guards";
import { evaluateExplicitRule, projectOrderTotals } from "./service";

type ApplyInput = {
  orderId: string;
  ruleVersionId: string;
  orderLineId?: string;
  beneficiaryId?: string;
  authorizedById?: string;
  reason?: string;
  expectedOrderVersion: number;
  actor: CommandActor;
  operationId: string;
};

const json = (order: { id: string; version: number; subtotal: Prisma.Decimal; discountTotal: Prisma.Decimal; total: Prisma.Decimal }) => ({
  type: "Pos2Order", id: order.id, version: order.version,
  subtotal: order.subtotal.toFixed(2), discountTotal: order.discountTotal.toFixed(2), total: order.total.toFixed(2),
} as Prisma.InputJsonObject);

async function apply(input: ApplyInput, kind: Exclude<AdjustmentKind, "PROMOTION">) {
  const payload = { orderId: input.orderId, ruleVersionId: input.ruleVersionId, orderLineId: input.orderLineId ?? null, beneficiaryId: input.beneficiaryId ?? null, authorizedById: input.authorizedById ?? null, reason: input.reason?.trim() || null, expectedOrderVersion: input.expectedOrderVersion };
  return executeIdempotent({ operationId: input.operationId, command: kind === "COURTESY" ? "ApplyCourtesy" : "ApplyDiscount", payload, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    requireActorBranch(input.actor, order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion);
    const rule = await tx.adjustmentVersion.findUnique({ where: { id: input.ruleVersionId }, select: { kind: true, requiresBeneficiary: true } });
    if (!rule || rule.kind !== kind) throw new DomainError("VALIDATION_ERROR", { field: "ruleVersionId" });
    const capability = kind === "COURTESY" ? "pos.courtesy.apply" : rule.requiresBeneficiary ? "pos.discount.employee.apply" : "pos.discount.manual.apply";
    await requireCapability(tx, input.actor, capability, order.branchId);
    if (kind === "COURTESY" && (!input.reason?.trim() || !input.authorizedById)) throw new DomainError("VALIDATION_ERROR", { field: "reason" });
    if (input.beneficiaryId === input.actor.id && input.authorizedById === input.actor.id) throw new DomainError("PERMISSION_DENIED", { reason: "self_authorization" });
    let updated;
    try { updated = await evaluateExplicitRule(tx, { ...input, actorId: input.actor.id, at: new Date() }); }
    catch (error) { if (error instanceof Error) throw new DomainError("VALIDATION_ERROR", { reason: error.message }); throw error; }
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, terminalId: order.terminalId, action: kind === "COURTESY" ? "COURTESY_APPLIED" : "DISCOUNT_APPLIED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: payload });
    return json(updated);
  } });
}

export const applyDiscount = (input: ApplyInput) => apply(input, "DISCOUNT");
export const applyCourtesy = (input: ApplyInput) => apply(input, "COURTESY");

export async function removeOrderAdjustment(input: { orderId: string; adjustmentId: string; expectedOrderVersion: number; actor: CommandActor; operationId: string }) {
  return executeIdempotent({ operationId: input.operationId, command: "RemoveOrderAdjustment", payload: { orderId: input.orderId, adjustmentId: input.adjustmentId, expectedOrderVersion: input.expectedOrderVersion }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const order = await lockOrder(tx, input.orderId); requireActorBranch(input.actor, order.branchId); requireOpenOrder(order); requireExpectedVersion(order, input.expectedOrderVersion);
    const adjustment = await tx.orderAdjustment.findFirst({ where: { id: input.adjustmentId, orderId: order.id, status: "APPLIED", automatic: false } });
    if (!adjustment) throw new DomainError("VALIDATION_ERROR", { field: "adjustmentId" });
    await requireCapability(tx, input.actor, adjustment.kind === "COURTESY" ? "pos.courtesy.apply" : "pos.discount.manual.apply", order.branchId);
    const at = new Date();
    await tx.orderAdjustment.updateMany({ where: { orderId: order.id, operationId: adjustment.operationId, status: "APPLIED" }, data: { status: "REVOKED", revokedAt: at, revokedById: input.actor.id } });
    const updated = await projectOrderTotals(tx, order.id, input.actor.id, at);
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: order.branchId, action: "ORDER_ADJUSTMENT_REMOVED", entityType: "Pos2Order", entityId: order.id, operationId: input.operationId, metadata: { adjustmentId: input.adjustmentId, originalOperationId: adjustment.operationId } });
    return json(updated);
  } });
}
