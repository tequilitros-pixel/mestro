import test from "node:test";
import assert from "node:assert/strict";

import {
  isSyntheticWorkforceRecord,
  normalizeEmploymentStatusFilter,
  shouldShowEmployment,
} from "../../lib/workforce/timesheet/visibility";

test("timesheet visibility defaults to active employments", () => {
  assert.equal(normalizeEmploymentStatusFilter(undefined), "ACTIVE");
  assert.equal(normalizeEmploymentStatusFilter("unknown"), "ACTIVE");
  assert.equal(
    shouldShowEmployment({ status: "ACTIVE", displayName: "María Real" }, "ACTIVE"),
    true,
  );
  assert.equal(
    shouldShowEmployment({ status: "INACTIVE", displayName: "María Real" }, "ACTIVE"),
    false,
  );
});

test("synthetic active records stay hidden by default but remain available in history", () => {
  for (const displayName of [
    "QA Scheduler",
    "Test Employee",
    "CERT fixture",
    "Demo Employee",
    "Prueba histórica",
    "Synthetic record",
    "EJEMPLO",
  ]) {
    assert.equal(isSyntheticWorkforceRecord(displayName), true, displayName);
    assert.equal(
      shouldShowEmployment({ status: "ACTIVE", displayName }, "ACTIVE"),
      false,
      displayName,
    );
    assert.equal(
      shouldShowEmployment({ status: "ACTIVE", displayName }, "ALL"),
      true,
      displayName,
    );
  }
  assert.equal(isSyntheticWorkforceRecord("Contestación Real"), false);
});

test("inactive and terminated filters preserve their historical records", () => {
  assert.equal(
    shouldShowEmployment({ status: "INACTIVE", displayName: "María Real" }, "INACTIVE"),
    true,
  );
  assert.equal(
    shouldShowEmployment({ status: "TERMINATED", displayName: "María Real" }, "TERMINATED"),
    true,
  );
  assert.equal(
    shouldShowEmployment({ status: "TERMINATED", displayName: "QA Historical" }, "TERMINATED"),
    true,
  );
});
