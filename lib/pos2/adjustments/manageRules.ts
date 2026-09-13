import "server-only";
import { Prisma, type AdjustmentKind, type AdjustmentMechanic, type AdjustmentScope, type AdjustmentStacking, type AdjustmentTargetType } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, type CommandActor } from "@/lib/pos2/authorization";
import { executeIdempotent } from "@/lib/pos2/idempotency";

export type PublishRuleInput = {
  definitionId?: string; code: string; name: string; description?: string; kind: AdjustmentKind; mechanic: AdjustmentMechanic;
  scope: AdjustmentScope; branchId?: string; targetType: AdjustmentTargetType; targetId?: string;
  percentage?: string; amount?: string; bundleQuantity?: string; priority?: number; stacking?: AdjustmentStacking;
  excludedProductIds?: string[]; excludedCategoryIds?: string[]; requiresBeneficiary?: boolean; requiresAuthorization?: boolean;
  maxAmount?: string; validFrom: Date; validTo?: Date; weekdays?: number[]; startMinute?: number; endMinute?: number; timezone?: string;
  actor: CommandActor; operationId: string;
};

const capability = (kind: AdjustmentKind) => kind === "PROMOTION" ? "pos.promotion.manage" as const : kind === "DISCOUNT" ? "pos.discount.manage" as const : "pos.courtesy.manage" as const;

export async function publishAdjustmentVersion(input: PublishRuleInput) {
  const payload = { ...input, actor: undefined, validFrom: input.validFrom.toISOString(), validTo: input.validTo?.toISOString() ?? null };
  return executeIdempotent({ operationId: input.operationId, command: "PublishAdjustmentVersion", payload, receiptContext: { actorId: input.actor.id, branchId: input.branchId }, execute: async (tx) => {
    await requireCapability(tx, input.actor, capability(input.kind), input.branchId);
    if ((input.scope === "BRANCH") !== Boolean(input.branchId)) throw new DomainError("VALIDATION_ERROR", { field: "branchId" });
    if ((input.mechanic === "PERCENT_OFF") !== Boolean(input.percentage) || (input.mechanic === "FIXED_BUNDLE_PRICE" && (!input.amount || !input.bundleQuantity))) throw new DomainError("VALIDATION_ERROR", { field: "mechanic" });
    if ((input.startMinute == null) !== (input.endMinute == null)) throw new DomainError("VALIDATION_ERROR", { field: "timeWindow" });
    const definition = input.definitionId
      ? await tx.adjustmentDefinition.findUniqueOrThrow({ where: { id: input.definitionId } })
      : await tx.adjustmentDefinition.create({ data: { code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description?.trim() || null, createdById: input.actor.id } });
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${definition.id}))`;
    const latest = await tx.adjustmentVersion.aggregate({ where: { definitionId: definition.id }, _max: { version: true } });
    const version = await tx.adjustmentVersion.create({ data: { definitionId: definition.id, version: (latest._max.version ?? 0) + 1, kind: input.kind, mechanic: input.mechanic, scope: input.scope, branchId: input.branchId ?? null, targetType: input.targetType, targetId: input.targetId ?? null, percentage: input.percentage, amount: input.amount, bundleQuantity: input.bundleQuantity, priority: input.priority ?? 0, stacking: input.stacking ?? "EXCLUSIVE", excludedProductIds: input.excludedProductIds ?? [], excludedCategoryIds: input.excludedCategoryIds ?? [], requiresBeneficiary: input.requiresBeneficiary ?? false, requiresAuthorization: input.requiresAuthorization ?? false, maxAmount: input.maxAmount, validFrom: input.validFrom, validTo: input.validTo ?? null, weekdays: input.weekdays ?? [], startMinute: input.startMinute, endMinute: input.endMinute, timezone: input.timezone ?? "America/Mexico_City", createdById: input.actor.id, operationId: input.operationId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: "ADJUSTMENT_VERSION_PUBLISHED", entityType: "AdjustmentVersion", entityId: version.id, operationId: input.operationId, metadata: { definitionId: definition.id, code: definition.code, version: version.version, kind: version.kind } });
    return { type: "AdjustmentVersion", id: version.id, definitionId: definition.id, code: definition.code, version: version.version } as Prisma.InputJsonObject;
  } });
}

export async function endAdjustmentVersion(input: { versionId: string; effectiveAt: Date; reason: string; actor: CommandActor; operationId: string }) {
  return executeIdempotent({ operationId: input.operationId, command: "EndAdjustmentVersion", payload: { versionId: input.versionId, effectiveAt: input.effectiveAt.toISOString(), reason: input.reason.trim() }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const version = await tx.adjustmentVersion.findUniqueOrThrow({ where: { id: input.versionId } }); await requireCapability(tx, input.actor, capability(version.kind), version.branchId ?? undefined);
    if (input.reason.trim().length < 3) throw new DomainError("VALIDATION_ERROR", { field: "reason" });
    const termination = await tx.adjustmentVersionTermination.create({ data: { versionId: version.id, effectiveAt: input.effectiveAt, reason: input.reason.trim(), actorId: input.actor.id, operationId: input.operationId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: version.branchId ?? undefined, action: "ADJUSTMENT_VERSION_ENDED", entityType: "AdjustmentVersion", entityId: version.id, operationId: input.operationId, metadata: { effectiveAt: input.effectiveAt.toISOString(), reason: termination.reason } });
    return { type: "AdjustmentVersionTermination", id: termination.id, versionId: version.id, effectiveAt: termination.effectiveAt.toISOString() } as Prisma.InputJsonObject;
  } });
}
