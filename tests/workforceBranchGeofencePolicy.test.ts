import assert from "node:assert/strict";
import test from "node:test";

import {
  geofenceDecision,
  resolveBranchGeofencePolicy,
} from "@/lib/workforce/geofence";

const globalWarn = {
  requireGeolocationClockIn: true,
  requireGeolocationClockOut: true,
  geofenceOutsideBehavior: "ALLOW_WITH_EXCEPTION" as const,
  requireOutsideGeofenceReview: true,
  maximumGpsAccuracyMeters: 100,
};

const configuredBranch = {
  geofenceEnabled: true,
  geofence: { latitude: 20, longitude: -103, radius: 100 },
};

test("branch OFF overrides the global policy", () => {
  const resolved = resolveBranchGeofencePolicy(
    { ...configuredBranch, geofenceMode: "OFF" },
    globalWarn,
  );

  assert.equal(resolved.mode, "OFF");
  assert.equal(resolved.requireGeolocationClockIn, false);
  assert.equal(resolved.requireGeolocationClockOut, false);
  assert.equal(resolved.requireOutsideGeofenceReview, false);
});

test("branch WARN overrides a global BLOCK policy", () => {
  const resolved = resolveBranchGeofencePolicy(
    { ...configuredBranch, geofenceMode: "WARN" },
    { ...globalWarn, geofenceOutsideBehavior: "BLOCK" },
  );

  assert.equal(resolved.mode, "WARN");
  assert.equal(resolved.geofenceOutsideBehavior, "ALLOW_WITH_EXCEPTION");
  assert.equal(resolved.requireOutsideGeofenceReview, true);
  assert.equal(geofenceDecision("OUTSIDE", resolved.geofenceOutsideBehavior).allow, true);
});

test("branch BLOCK overrides a global WARN policy", () => {
  const resolved = resolveBranchGeofencePolicy(
    { ...configuredBranch, geofenceMode: "BLOCK" },
    globalWarn,
  );

  assert.equal(resolved.mode, "BLOCK");
  assert.equal(resolved.geofenceOutsideBehavior, "BLOCK");
  assert.equal(geofenceDecision("OUTSIDE", resolved.geofenceOutsideBehavior).allow, false);
  assert.equal(geofenceDecision("PERMISSION_DENIED", resolved.geofenceOutsideBehavior).allow, false);
});

test("a branch without an override uses the global mode", () => {
  const resolved = resolveBranchGeofencePolicy(
    { ...configuredBranch, geofenceMode: null },
    globalWarn,
  );

  assert.equal(resolved.mode, "WARN");
  assert.equal(resolved.geofenceOutsideBehavior, "ALLOW_WITH_EXCEPTION");
});

test("a branch without a configured geofence remains OFF", () => {
  const resolved = resolveBranchGeofencePolicy(
    { geofenceEnabled: false, geofence: null, geofenceMode: null },
    globalWarn,
  );

  assert.equal(resolved.mode, "OFF");
  assert.equal(resolved.requireGeolocationClockIn, false);
});
