import assert from "node:assert/strict";
import test from "node:test";
import { inspectTimeline, selectEffectivePrice, targetKey, timelineState, type PriceTimelineEntry } from "@/lib/pos2/pricing/domain";

const at = new Date("2026-08-31T12:00:00.000Z");
const entry = (id: string, scope: "GLOBAL" | "BRANCH", from: string, to: string | null, amount = "99.00"): PriceTimelineEntry => ({ id, scope, amount, validFrom: new Date(from), validTo: to ? new Date(to) : null, terminatedAt: null });

test("branch price deterministically wins over global price", () => {
  const result = selectEffectivePrice([entry("global", "GLOBAL", "2026-01-01Z", null), entry("branch", "BRANCH", "2026-08-01Z", null, "95")], at);
  assert.equal(result?.priceVersionId, "branch"); assert.equal(result?.money.toString(), "95.00"); assert.equal(result?.explanation, "BRANCH_OVERRIDE");
});
test("validity uses an inclusive start and exclusive end", () => {
  const exact = entry("next", "GLOBAL", at.toISOString(), "2026-09-01T00:00:00Z");
  assert.equal(selectEffectivePrice([exact], at)?.priceVersionId, "next");
  assert.equal(selectEffectivePrice([exact], new Date("2026-09-01T00:00:00Z")), null);
});
test("absence remains null and never fabricates zero", () => assert.equal(selectEffectivePrice([], at), null));
test("timeline inspection exposes gaps and overlaps", () => {
  const gap = inspectTimeline([entry("a", "GLOBAL", "2026-01-01Z", "2026-02-01Z"), entry("b", "GLOBAL", "2026-03-01Z", null)]);
  assert.equal(gap.gaps.length, 1); assert.equal(gap.overlaps.length, 0);
  assert.equal(inspectTimeline([entry("a", "GLOBAL", "2026-01-01Z", null), entry("b", "GLOBAL", "2026-03-01Z", null)]).overlaps.length, 1);
});
test("termination and scheduled state are explicit", () => {
  const scheduled = entry("future", "GLOBAL", "2027-01-01Z", null); assert.equal(timelineState(scheduled, at), "SCHEDULED");
  assert.equal(timelineState({ ...entry("ended", "GLOBAL", "2026-01-01Z", null), terminatedAt: new Date("2026-02-01Z") }, at), "ENDED");
});
test("target contract rejects ambiguous input", () => { assert.equal(targetKey({ variantId: "v1" }), "VARIANT:v1"); assert.throws(() => targetKey({ productId: "p", variantId: "v" })); });
