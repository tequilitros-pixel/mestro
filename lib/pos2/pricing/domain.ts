import { Money } from "@/lib/domain/money";

export type PriceTimelineEntry = {
  id: string;
  scope: "GLOBAL" | "BRANCH";
  amount: string;
  validFrom: Date;
  validTo: Date | null;
  terminatedAt: Date | null;
};

export function effectiveEnd(entry: Pick<PriceTimelineEntry, "validTo" | "terminatedAt">) {
  if (!entry.validTo) return entry.terminatedAt;
  if (!entry.terminatedAt) return entry.validTo;
  return entry.validTo < entry.terminatedAt ? entry.validTo : entry.terminatedAt;
}

export function containsTimestamp(entry: PriceTimelineEntry, at: Date) {
  const end = effectiveEnd(entry);
  return entry.validFrom <= at && (!end || at < end);
}

export function selectEffectivePrice(entries: PriceTimelineEntry[], at: Date) {
  const current = entries.filter((entry) => containsTimestamp(entry, at));
  const branch = current.filter((entry) => entry.scope === "BRANCH");
  const global = current.filter((entry) => entry.scope === "GLOBAL");
  if (branch.length > 1 || global.length > 1) throw new Error("Overlapping price timeline");
  const selected = branch[0] ?? global[0] ?? null;
  if (!selected) return null;
  return {
    priceVersionId: selected.id,
    money: Money.from(selected.amount),
    explanation: selected.scope === "BRANCH" ? "BRANCH_OVERRIDE" as const : "GLOBAL_BASE_PRICE" as const,
  };
}

export function timelineState(entry: PriceTimelineEntry, at: Date) {
  const end = effectiveEnd(entry);
  if (entry.terminatedAt && entry.terminatedAt <= at) return "ENDED" as const;
  if (entry.validFrom > at) return "SCHEDULED" as const;
  if (end && end <= at) return "EXPIRED" as const;
  return "CURRENT" as const;
}

export function inspectTimeline(entries: PriceTimelineEntry[]) {
  const ordered = [...entries].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
  const gaps: Array<{ from: Date; to: Date }> = [];
  const overlaps: Array<{ leftId: string; rightId: string }> = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const end = effectiveEnd(previous);
    if (!end) overlaps.push({ leftId: previous.id, rightId: ordered[index].id });
    else if (end > ordered[index].validFrom) overlaps.push({ leftId: previous.id, rightId: ordered[index].id });
    else if (end < ordered[index].validFrom) gaps.push({ from: end, to: ordered[index].validFrom });
  }
  return { ordered, gaps, overlaps };
}

export function targetKey(input: { productId?: string; variantId?: string }) {
  if (!!input.productId === !!input.variantId) throw new Error("Exactly one price target is required");
  return input.variantId ? `VARIANT:${input.variantId}` : `PRODUCT:${input.productId}`;
}
