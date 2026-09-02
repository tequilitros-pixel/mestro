import assert from "node:assert/strict";
import test from "node:test";
import { scheduleEligibleEmploymentWhere } from "../../lib/workforce/scheduling/eligibility";

const start = new Date("2026-08-31T00:00:00.000Z");
const end = new Date("2026-09-06T00:00:00.000Z");

test("Scheduler eligibility requires active employment assigned to the selected branch", () => {
  const where = scheduleEligibleEmploymentWhere("barra", start, end);
  assert.equal(where.status, "ACTIVE");
  assert.equal(where.branchAssignments.some.branchId, "barra");
  assert.deepEqual(where.branchAssignments.some.effectiveFrom, { lte: end });
  assert.deepEqual(where.branchAssignments.some.OR, [
    { effectiveTo: null },
    { effectiveTo: { gte: start } },
  ]);
});

test("availability is not an eligibility filter", () => {
  const where = scheduleEligibleEmploymentWhere("barra", start, end);
  assert.equal("availabilityRules" in where, false);
  assert.equal("availabilityExceptions" in where, false);
});

test("an assignment for another branch cannot satisfy the selected branch", () => {
  const where = scheduleEligibleEmploymentWhere("barra", start, end);
  assert.notEqual(where.branchAssignments.some.branchId, "canoas");
});
