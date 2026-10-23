import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain/errors";
import { selectEffectivePrice, targetKey, type PriceTimelineEntry } from "./domain";

export type ResolvePriceInput = { productId?: string; variantId?: string; branchId: string; at: Date; currency?: "MXN" };

type PricingClient = Pick<Prisma.TransactionClient, "priceVersion">;

export async function resolvePrice(input: ResolvePriceInput, client: PricingClient = prisma) {
  const results = await resolvePricesBatch([input], client);
  const result = results[0];
  if (!result) throw new DomainError("PRICE_NOT_CONFIGURED", { targetKey: targetKey(input), branchId: input.branchId });
  return result;
}

export async function resolvePricesBatch(inputs: ResolvePriceInput[], client: PricingClient = prisma) {
  if (inputs.length === 0) return [];
  const at = inputs[0].at;
  const branchId = inputs[0].branchId;
  const currency = inputs[0].currency ?? "MXN";
  if (!inputs.every((item) => item.at.getTime() === at.getTime() && item.branchId === branchId && (item.currency ?? "MXN") === currency)) {
    throw new DomainError("VALIDATION_ERROR", { field: "batchContext" });
  }
  const keys = inputs.map(targetKey);
  const versions = await client.priceVersion.findMany({
    where: {
      targetKey: { in: keys }, currency, validFrom: { lte: at },
      OR: [{ scope: "GLOBAL" }, { scope: "BRANCH", branchId }],
    },
    include: { termination: true },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
  });
  const byKey = new Map<string, PriceTimelineEntry[]>();
  for (const version of versions) {
    const list = byKey.get(version.targetKey) ?? [];
    list.push({ id: version.id, scope: version.scope, amount: version.amount.toFixed(2), validFrom: version.validFrom, validTo: version.validTo, terminatedAt: version.termination?.effectiveAt ?? null });
    byKey.set(version.targetKey, list);
  }
  return inputs.map((item) => {
    const key = targetKey(item);
    const selected = selectEffectivePrice(byKey.get(key) ?? [], at);
    return selected ? { targetKey: key, branchId, at: at.toISOString(), amount: selected.money.toString(), currency, taxIncluded: true, explanation: selected.explanation, priceVersionId: selected.priceVersionId } : null;
  });
}
