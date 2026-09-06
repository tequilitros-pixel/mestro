import "server-only";
import { prisma } from "@/lib/prisma";
import { inspectTimeline, timelineState, type PriceTimelineEntry } from "./domain";

export async function getPriceHistory(input: { productId?: string; variantId?: string; branchId?: string; at?: Date }) {
  const key = input.variantId ? `VARIANT:${input.variantId}` : input.productId ? `PRODUCT:${input.productId}` : undefined;
  const at = input.at ?? new Date();
  const versions = await prisma.priceVersion.findMany({
    where: { ...(key ? { targetKey: key } : {}), ...(input.branchId ? { OR: [{ scope: "GLOBAL" }, { branchId: input.branchId }] } : {}) },
    include: { termination: true, branch: { select: { name: true } }, product: { select: { name: true } }, variant: { select: { name: true, product: { select: { name: true } } } } },
    orderBy: [{ targetKey: "asc" }, { branchKey: "asc" }, { validFrom: "desc" }],
  });
  return versions.map((version) => {
    const entry: PriceTimelineEntry = { id: version.id, scope: version.scope, amount: version.amount.toFixed(2), validFrom: version.validFrom, validTo: version.validTo, terminatedAt: version.termination?.effectiveAt ?? null };
    return { ...version, amount: version.amount.toFixed(2), state: timelineState(entry, at), effectiveEnd: version.termination?.effectiveAt ?? version.validTo };
  });
}

export function analyzePriceHistory(entries: PriceTimelineEntry[]) {
  return inspectTimeline(entries);
}
