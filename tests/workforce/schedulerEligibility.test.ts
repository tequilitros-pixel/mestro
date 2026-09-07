import assert from "node:assert/strict";
import test from "node:test";
import { scheduleEligibleEmploymentWhere } from "../../lib/workforce/scheduling/eligibility";
test("Scheduler requires active employment without assignment or availability filters", () => {
  assert.deepEqual(scheduleEligibleEmploymentWhere(), { status: "ACTIVE" });
});
