import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGeofence, geofenceDecision, requiresLocation } from "@/lib/workforce/geofence";
import type { LocationInput } from "@/lib/workforce/geofence";

const branch = {
  geofenceEnabled: true,
  geofence: { latitude: 20, longitude: -103, radius: 100 },
};

test("untrusted JSON cannot declare INSIDE or NOT_REQUIRED as a failure", () => {
  for (const failure of ["INSIDE", "NOT_REQUIRED", "OUTSIDE", "unknown"]) {
    const input = JSON.parse(JSON.stringify({ failure })) as LocationInput;
    const result = evaluateGeofence(branch, input, true, 50);
    assert.equal(result.result, "UNAVAILABLE");
    assert.equal(geofenceDecision(result.result, "BLOCK").allow, false);
  }
});

test("geofence accepts inside and exact-boundary readings", () => {
  const inside = evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters: 10 } }, true, 50);
  assert.equal(inside.result, "INSIDE");

  const boundary = evaluateGeofence(
    { geofenceEnabled: true, geofence: { latitude: 0, longitude: 0, radius: 0 } },
    { sample: { latitude: 0, longitude: 0 } },
    true,
    100,
  );
  assert.equal(boundary.result, "INSIDE");
});

test("geofence distinguishes outside, denied, unavailable and low accuracy", () => {
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20.01, longitude: -103 } }, true, 50).result, "OUTSIDE");
  assert.equal(evaluateGeofence(branch, { failure: "PERMISSION_DENIED" }, true, 50).result, "PERMISSION_DENIED");
  assert.equal(evaluateGeofence(branch, { failure: "UNAVAILABLE" }, true, 50).result, "UNAVAILABLE");
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters: 80 } }, true, 50).result, "LOW_ACCURACY");
});

test("disabled or unconfigured branches never request location", () => {
  assert.equal(requiresLocation({ ...branch, geofenceEnabled: false }, true), false);
  assert.equal(requiresLocation({ geofenceEnabled: true, geofence: null }, true), false);
  assert.equal(evaluateGeofence(branch, null, false, 50).result, "NOT_REQUIRED");
});

test("outside policy can block or allow with a review exception", () => {
  assert.deepEqual(geofenceDecision("OUTSIDE", "BLOCK"), { allow: false, needsReview: false });
  assert.deepEqual(geofenceDecision("OUTSIDE", "ALLOW_WITH_EXCEPTION"), { allow: true, needsReview: true });
});
