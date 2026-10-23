import "server-only";
import { prisma } from "@/lib/prisma";
import { Money } from "@/lib/domain/money";
import { appendAuditEvent } from "@/lib/pos2/audit";
import { resolvePrice } from "./resolvePrice";

export async function validateLegacyPriceShadow(input: { variantId: string; branchId: string; at: Date; actorId?: string; operationId?: string }) {
  const variant = await prisma.posProductVariant.findUniqueOrThrow({ where: { id: input.variantId }, select: { price: true } });
  const effective = await resolvePrice(input);
  const legacy = Money.fromLegacyFloat(variant.price);
  const matches = legacy.toString() === effective.amount;
  if (!matches) await prisma.$transaction((tx) => appendAuditEvent(tx, {
    actorId: input.actorId, branchId: input.branchId, action: "pricing.shadow_mismatch", entityType: "PosProductVariant", entityId: input.variantId, operationId: input.operationId,
    metadata: { legacyAmount: legacy.toString(), v2Amount: effective.amount, priceVersionId: effective.priceVersionId, at: input.at.toISOString() },
  }));
  return { matches, legacyAmount: legacy.toString(), v2Amount: effective.amount, priceVersionId: effective.priceVersionId };
}
