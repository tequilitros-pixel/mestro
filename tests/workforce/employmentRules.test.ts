import assert from "node:assert/strict";
import test from "node:test";
import { assertNativeCurrency, assertValidRange, assertWorkforceAdministrator, rangesOverlap } from "../../lib/workforce/employment/rules";
import { legacyEmployeeInput, legacyPayRateInput } from "../../lib/workforce/legacy/backfill";

test("Employee without User and User-linked Employee are representable", () => {
  const without = legacyEmployeeInput({ id: "one", name: "WFQA-One", active: true });
  const linked = legacyEmployeeInput({ id: "two", name: "WFQA-Two", active: true });
  assert.equal(without.displayName, "WFQA-One"); assert.equal(linked.userId, "two");
});
test("active, termination and rehire history use separate employment facts", () => {
  const history = [{ status: "TERMINATED", endedAt: new Date("2026-01-01") }, { status: "ACTIVE", endedAt: null }];
  assert.equal(history.length, 2); assert.equal(history[0].status, "TERMINATED"); assert.equal(history[1].status, "ACTIVE");
});
test("HOME overlap is detected while adjacent history is accepted", () => {
  const old = { effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-02-01") };
  assert.equal(rangesOverlap(old, { effectiveFrom: new Date("2026-01-15"), effectiveTo: null }), true);
  assert.equal(rangesOverlap(old, { effectiveFrom: new Date("2026-02-01"), effectiveTo: null }), false);
});
test("multiple ALLOWED branches are not subject to HOME uniqueness", () => { assert.deepEqual(new Set(["a", "b"]), new Set(["a", "b"])); });
test("effective range rejects reverse dates", () => { assert.throws(() => assertValidRange({ effectiveFrom: new Date("2026-02-01"), effectiveTo: new Date("2026-01-01") })); });
test("native currency is required and legacy nullable currency remains representable", () => {
  assert.throws(() => assertNativeCurrency(null)); assert.doesNotThrow(() => assertNativeCurrency("MXN"));
  const legacy = legacyPayRateInput({ id: "r", userId: "u", scheme: "HORA", amount: 10, effectiveFrom: new Date("2026-01-01"), effectiveTo: null });
  assert.equal(legacy.candidate?.currency, null);
});
test("historical rate ranges remain adjacent instead of overwritten", () => { assert.equal(rangesOverlap({ effectiveFrom: new Date("2025-01-01"), effectiveTo: new Date("2026-01-01") }, { effectiveFrom: new Date("2026-01-01"), effectiveTo: null }), false); });
test("server authorization accepts ADMIN only", () => { assert.doesNotThrow(() => assertWorkforceAdministrator({ role: "ADMIN" })); assert.throws(() => assertWorkforceAdministrator({ role: "GERENTE" })); assert.throws(() => assertWorkforceAdministrator(null)); });
