import assert from "node:assert/strict";
import test from "node:test";
import { resolveBranchHourlyRate, summarizeHourlyRates } from "../lib/payroll/branchRates";
import { computeHourlyPay } from "../lib/payroll/legacyRules";

test("applies a branch rate only to work after it takes effect", () => {
  const effectiveFrom = new Date("2026-10-05T16:00:00Z");
  const rows = [{ branchId: "barra", amount: 50, effectiveFrom, effectiveTo: null }];
  assert.equal(resolveBranchHourlyRate(rows, "barra", new Date("2026-10-05T15:00:00Z"), 39), 39);
  assert.equal(resolveBranchHourlyRate(rows, "barra", effectiveFrom, 39), 50);
  assert.equal(resolveBranchHourlyRate(rows, "sucursal", effectiveFrom, 39), 39);
});

test("closing an override falls back to the general rate without changing old work", () => {
  const rows = [{
    branchId: "barra", amount: 50,
    effectiveFrom: new Date("2026-10-05T16:00:00Z"),
    effectiveTo: new Date("2026-10-06T16:00:00Z"),
  }];
  assert.equal(resolveBranchHourlyRate(rows, "barra", new Date("2026-10-06T15:00:00Z"), 39), 50);
  assert.equal(resolveBranchHourlyRate(rows, "barra", new Date("2026-10-06T16:00:00Z"), 39), 39);
});

test("mixed branch shifts show variable rate and preserve missing rate detection", () => {
  assert.deepEqual(summarizeHourlyRates([39, 50], 39), {
    hourlyRate: null, missingRate: false, variableRate: true,
  });
  assert.deepEqual(summarizeHourlyRates([null, 50], null), {
    hourlyRate: 50, missingRate: true, variableRate: false,
  });
});

test("Rubí's two branch shifts use 39 and 50 in the same payroll week", () => {
  const workedAt = new Date("2026-10-06T18:00:00Z");
  const rows = [{ branchId: "barra", amount: 50, effectiveFrom: new Date("2026-10-05T16:00:00Z"), effectiveTo: null }];
  const branchPay = computeHourlyPay(2, resolveBranchHourlyRate(rows, "sucursal", workedAt, 39))
    + computeHourlyPay(3, resolveBranchHourlyRate(rows, "barra", workedAt, 39));
  assert.equal(branchPay, 228);
});
