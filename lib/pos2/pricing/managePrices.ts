import "server-only";
import { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { Money } from "@/lib/domain/money";
import { executeIdempotent } from "@/lib/pos2/idempotency";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { requireCapability, requireGlobalCapability, type CommandActor } from "@/lib/pos2/authorization";
import { requireActorBranch } from "@/lib/pos2/cash/guards";
import { targetKey } from "./domain";

type Target = { productId: string; variantId?: never } | { variantId: string; productId?: never };
type Scope = { scope: "GLOBAL"; branchId?: never } | { scope: "BRANCH"; branchId: string };

export async function createPriceVersion(input: Target & Scope & { operationId: string; actor: CommandActor; amount: string; currency?: "MXN"; taxIncluded?: true; validFrom: Date; validTo?: Date | null }) {
  const money = Money.nonNegative(input.amount, input.currency ?? "MXN");
  if (!Number.isFinite(input.validFrom.getTime()) || (input.validTo && (!Number.isFinite(input.validTo.getTime()) || input.validTo <= input.validFrom))) throw new DomainError("VALIDATION_ERROR", { field: "validity" });
  const key = targetKey(input);
  const payload = { key, scope: input.scope, branchId: input.branchId ?? null, amount: money.toString(), currency: input.currency ?? "MXN", validFrom: input.validFrom.toISOString(), validTo: input.validTo?.toISOString() ?? null };
  return executeIdempotent({ operationId: input.operationId, command: "pricing.version.create", payload, receiptContext: { actorId: input.actor.id, branchId: input.branchId }, execute: async (tx) => {
    if (input.scope === "BRANCH" && !input.branchId) throw new DomainError("VALIDATION_ERROR", { field: "branchId" });
    if (input.scope === "GLOBAL") await requireGlobalCapability(tx, input.actor, "pricing.create");
    else {
      requireActorBranch(input.actor, input.branchId);
      await requireCapability(tx, input.actor, "pricing.create", input.branchId);
      await requireCapability(tx, input.actor, "pricing.branch_override", input.branchId);
    }
    if (input.validFrom > new Date()) {
      if (input.scope === "GLOBAL") await requireGlobalCapability(tx, input.actor, "pricing.edit_future");
      else await requireCapability(tx, input.actor, "pricing.edit_future", input.branchId);
    }
    await assertTarget(tx, input);
    let version;
    try {
      version = await tx.priceVersion.create({ data: {
        targetType: input.variantId ? "VARIANT" : "PRODUCT", targetKey: key,
        productId: input.productId ?? null, variantId: input.variantId ?? null,
        scope: input.scope, branchId: input.branchId ?? null, branchKey: input.branchId ? `BRANCH:${input.branchId}` : "GLOBAL",
        amount: money.toDecimal(), currency: input.currency ?? "MXN", taxIncluded: true,
        validFrom: input.validFrom, validTo: input.validTo ?? null, createdById: input.actor.id, operationId: input.operationId,
      } });
    } catch (error) {
      if (String((error as { code?: string }).code) === "P2010" || String(error).includes("23P01") || String(error).includes("PRICE_WINDOW_OVERLAP")) throw new DomainError("CONFLICT", { targetKey: key }, "La vigencia se solapa con otro precio publicado.");
      throw error;
    }
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: input.branchId, action: "pricing.version.published", entityType: "PriceVersion", entityId: version.id, operationId: input.operationId, metadata: payload });
    return { type: "PriceVersion", id: version.id, amount: money.toString(), currency: version.currency, targetKey: key, scope: version.scope, validFrom: version.validFrom.toISOString(), validTo: version.validTo?.toISOString() ?? null } as Prisma.InputJsonObject;
  } });
}

export async function endPriceVersion(input: { operationId: string; actor: CommandActor; priceVersionId: string; effectiveAt: Date; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 3 || !Number.isFinite(input.effectiveAt.getTime())) throw new DomainError("VALIDATION_ERROR", { field: "termination" });
  return executeIdempotent({ operationId: input.operationId, command: "pricing.version.end", payload: { priceVersionId: input.priceVersionId, effectiveAt: input.effectiveAt.toISOString(), reason }, receiptContext: { actorId: input.actor.id }, execute: async (tx) => {
    const version = await tx.priceVersion.findUnique({ where: { id: input.priceVersionId }, include: { termination: true } });
    if (!version) throw new DomainError("VALIDATION_ERROR", { field: "priceVersionId" });
    if (version.scope === "GLOBAL") await requireGlobalCapability(tx, input.actor, "pricing.end");
    else { requireActorBranch(input.actor, version.branchId!); await requireCapability(tx, input.actor, "pricing.end", version.branchId!); }
    if (version.termination) throw new DomainError("INVALID_STATE_TRANSITION", { priceVersionId: version.id });
    const termination = await tx.priceVersionTermination.create({ data: { priceVersionId: version.id, effectiveAt: input.effectiveAt, reason, createdById: input.actor.id, operationId: input.operationId } });
    await appendAuditEvent(tx, { actorId: input.actor.id, branchId: version.branchId ?? undefined, action: "pricing.version.ended", entityType: "PriceVersion", entityId: version.id, operationId: input.operationId, metadata: { effectiveAt: input.effectiveAt.toISOString(), reason } });
    return { type: "PriceVersionTermination", id: termination.id, priceVersionId: version.id, effectiveAt: termination.effectiveAt.toISOString() } as Prisma.InputJsonObject;
  } });
}

async function assertTarget(tx: Prisma.TransactionClient, input: Target) {
  if (input.variantId) {
    if (!await tx.posProductVariant.findUnique({ where: { id: input.variantId }, select: { id: true } })) throw new DomainError("VALIDATION_ERROR", { field: "variantId" });
  } else if (!await tx.posProduct.findUnique({ where: { id: input.productId }, select: { id: true } })) throw new DomainError("VALIDATION_ERROR", { field: "productId" });
}
