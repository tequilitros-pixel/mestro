import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEmployeeStatusFilter,
  selectEmploymentForStatus,
  type EmployeeListStatus,
} from "../../lib/workforce/employment/presentation";

const employment = (id: string, status: Exclude<EmployeeListStatus, "NONE">) => ({ id, status });

test("employee list defaults to active relationships", () => {
  assert.equal(normalizeEmployeeStatusFilter(undefined), "ACTIVE");
  assert.equal(normalizeEmployeeStatusFilter("unknown"), "ACTIVE");
});

test("active filter hides inactive and terminated employees", () => {
  const rows = [employment("active", "ACTIVE"), employment("inactive", "INACTIVE"), employment("terminated", "TERMINATED")];
  assert.equal(selectEmploymentForStatus(rows, "ACTIVE")?.id, "active");
  assert.equal(selectEmploymentForStatus([employment("inactive", "INACTIVE")], "ACTIVE"), null);
  assert.equal(selectEmploymentForStatus([employment("terminated", "TERMINATED")], "ACTIVE"), null);
});

test("inactive, terminated and all filters select the right relationship", () => {
  const history = [employment("inactive", "INACTIVE"), employment("old", "TERMINATED")];
  assert.equal(selectEmploymentForStatus(history, "INACTIVE")?.id, "inactive");
  assert.equal(selectEmploymentForStatus([employment("terminated", "TERMINATED")], "TERMINATED")?.id, "terminated");
  assert.equal(selectEmploymentForStatus(history, "ALL")?.id, "inactive");
});
