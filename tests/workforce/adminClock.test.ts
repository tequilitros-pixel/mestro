import assert from "node:assert/strict";
import test from "node:test";
import { isOperationalClockIdentity } from "../../app/workforce/clock/presentation";

test("operational Clock scope keeps only active Employee, User, and Employment", () => {
  assert.equal(isOperationalClockIdentity({ employeeActive: true, userActive: true, employmentStatus: "ACTIVE" }), true);
  assert.equal(isOperationalClockIdentity({ employeeActive: false, userActive: true, employmentStatus: "ACTIVE" }), false);
  assert.equal(isOperationalClockIdentity({ employeeActive: true, userActive: false, employmentStatus: "ACTIVE" }), false);
  assert.equal(isOperationalClockIdentity({ employeeActive: true, userActive: true, employmentStatus: "INACTIVE" }), false);
});
