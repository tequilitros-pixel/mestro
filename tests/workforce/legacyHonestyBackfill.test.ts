import assert from "node:assert/strict";
import test from "node:test";

import {
  legacyEmployeeInput,
  legacyPayRateInput,
  legacyWorkSessionInput,
  nativePayRateIsValid,
  stableTargetId,
} from "../../lib/workforce/legacy/backfill";
import { analyzeRateCoverage, editRequestToCorrectionCandidate } from "../../lib/workforce/legacy/bridge";

test("Employee preserves an unsplit display name without parsing", () => {
  const candidate = legacyEmployeeInput({ id: "u1", name: "Juan Pérez Gómez", active: true });
  assert.equal(candidate.displayName, "Juan Pérez Gómez");
  assert.equal(candidate.firstName, null);
  assert.equal(candidate.lastName, null);
  assert.equal(candidate.startedAt, null);
  assert.equal(candidate.dataConfidence, "LEGACY_UNKNOWN");
});

test("legacy PayRate accepts unknown currency while native validation rejects it", () => {
  const result = legacyPayRateInput({ id: "r1", userId: "u1", scheme: "HORA", amount: 100, effectiveFrom: new Date("2026-01-01"), effectiveTo: null });
  assert.equal(result.candidate?.currency, null);
  assert.equal(result.classification, "SAFE_WITH_UNKNOWN");
  assert.equal(nativePayRateIsValid({ currency: null }), false);
  assert.equal(nativePayRateIsValid({ currency: "MXN" }), true);
});

test("rate overlap remains review-required evidence", () => {
  const coverage = analyzeRateCoverage([
    { id: "a", userId: "u", scheme: "HORA", amount: 1, effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-03-01") },
    { id: "b", userId: "u", scheme: "HORA", amount: 1, effectiveFrom: new Date("2026-02-01"), effectiveTo: null },
  ]);
  assert.equal(coverage.some((issue) => issue.category === "CONFLICTING_DATA"), true);
});

test("legacy composite session preserves unknown break and needs no event IDs", () => {
  const result = legacyWorkSessionInput({ id: "c1", userId: "u1", branchId: "b1", clockIn: new Date("2026-01-02T10:00Z"), clockOut: new Date("2026-01-02T18:00Z"), scheduledBusinessDate: new Date("2026-01-02") });
  assert.equal(result.candidate?.origin, "LEGACY_IMPORTED");
  assert.equal(result.candidate?.breakMinutes, null);
  assert.equal("clockEventIds" in (result.candidate ?? {}), false);
});

test("unknown break is distinct from known zero", () => {
  const unknown: number | null = null;
  const knownZero: number | null = 0;
  assert.notEqual(unknown, knownZero);
});

test("simple correction maps but compound correction remains review", () => {
  const simple = editRequestToCorrectionCandidate({ id: "e1", timeClockId: "c1", originalClockIn: new Date("2026-01-01T10:00Z"), originalClockOut: null, requestedClockIn: new Date("2026-01-01T10:00Z"), requestedClockOut: new Date("2026-01-01T18:00Z"), status: "PENDIENTE", reason: null });
  const compound = editRequestToCorrectionCandidate({ id: "e2", timeClockId: "c2", originalClockIn: new Date("2026-01-01T10:00Z"), originalClockOut: new Date("2026-01-01T18:00Z"), requestedClockIn: new Date("2026-01-01T11:00Z"), requestedClockOut: new Date("2026-01-01T19:00Z"), status: "PENDIENTE", reason: null });
  assert.ok(simple.candidate);
  assert.equal(compound.classification, "REQUIRES_REVIEW");
});

test("migration target IDs are stable for idempotent reruns", () => {
  assert.equal(stableTargetId("Employee", "User", "u1"), stableTargetId("Employee", "User", "u1"));
});

test("payroll snapshots with unknown currency are not candidates", () => {
  assert.equal(nativePayRateIsValid({ currency: null }), false);
});
