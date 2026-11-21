import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesEmployeeStatusFilter,
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

test("employee active state is part of the operational filter", () => {
  assert.equal(matchesEmployeeStatusFilter({ active: true, status: "ACTIVE" }, "ACTIVE"), true);
  assert.equal(matchesEmployeeStatusFilter({ active: false, status: "ACTIVE" }, "ACTIVE"), false);
  assert.equal(matchesEmployeeStatusFilter({ active: false, status: "ACTIVE" }, "INACTIVE"), true);
  assert.equal(matchesEmployeeStatusFilter({ active: true, status: "INACTIVE" }, "INACTIVE"), true);
  assert.equal(matchesEmployeeStatusFilter({ active: false, status: "TERMINATED" }, "INACTIVE"), false);
  assert.equal(matchesEmployeeStatusFilter({ active: false, status: "TERMINATED" }, "TERMINATED"), true);
});
