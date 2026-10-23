import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeBranchCode,
  validBranchCode,
  validGeofenceConfig,
  validTimezone,
} from "@/lib/workforce/branch";

test("branch codes normalize and reject unsafe values", () => {
  assert.equal(normalizeBranchCode(" barra-01 "), "BARRA-01");
  assert.equal(validBranchCode("BARRA_01"), true);
  assert.equal(validBranchCode("A"), false);
  assert.equal(validBranchCode("BARRA 01"), false);
});

test("branch timezone accepts IANA names", () => {
  assert.equal(validTimezone("America/Mexico_City"), true);
  assert.equal(validTimezone("Not/A_Timezone"), false);
});

test("branch geofence validates coordinates and editable radius", () => {
  assert.equal(validGeofenceConfig(20.67, -103.35, 50), true);
  assert.equal(validGeofenceConfig(20.67, -103.35, 200), true);
  assert.equal(validGeofenceConfig(91, -103.35, 100), false);
  assert.equal(validGeofenceConfig(20.67, -181, 100), false);
  assert.equal(validGeofenceConfig(20.67, -103.35, 9), false);
});

test("branch administration deactivates records without physical delete", () => {
  const actions = readFileSync("app/actions/workforceBranches.ts", "utf8");
  assert.doesNotMatch(actions, /prisma\.branch\.delete/);
  assert.match(actions, /active:\s*input\.active/);
});
