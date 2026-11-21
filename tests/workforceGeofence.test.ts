import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGeofence, geofenceDecision, geofenceResultLabel, requiresLocation } from "@/lib/workforce/geofence";
import type { LocationInput } from "@/lib/workforce/geofence";

const branch = {
  geofenceEnabled: true,
  geofence: { latitude: 20, longitude: -103, radius: 100 },
};

test("missing, nonfinite and negative accuracy never prove presence", () => {
  for (const accuracyMeters of [undefined, NaN, Infinity, -1]) {
    const result = evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters } }, true, 100);
    assert.equal(result.result, "UNAVAILABLE");
    assert.equal(geofenceDecision(result.result, "BLOCK").allow, false);
    assert.equal(geofenceDecision(result.result, "ALLOW_WITH_EXCEPTION").needsReview, true);
  }
});

test("server computes outside despite a spoofed client verdict", () => {
  const forged = JSON.parse('{"result":"INSIDE","sample":{"latitude":21,"longitude":-103,"accuracyMeters":10}}') as LocationInput;
  assert.equal(evaluateGeofence(branch, forged, true, 100).result, "OUTSIDE");
});

test("500m accuracy is low, threshold itself is accepted", () => {
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters: 500 } }, true, 100).result, "LOW_ACCURACY");
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters: 100 } }, true, 100).result, "INSIDE");
});

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
    { sample: { latitude: 0, longitude: 0, accuracyMeters: 10 } },
    true,
    100,
  );
  assert.equal(boundary.result, "INSIDE");
});

test("geofence distinguishes outside, denied, unavailable and low accuracy", () => {
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20.01, longitude: -103, accuracyMeters: 10 } }, true, 50).result, "OUTSIDE");
  assert.equal(evaluateGeofence(branch, { failure: "PERMISSION_DENIED" }, true, 50).result, "PERMISSION_DENIED");
  assert.equal(evaluateGeofence(branch, { failure: "UNAVAILABLE" }, true, 50).result, "UNAVAILABLE");
  assert.equal(evaluateGeofence(branch, { sample: { latitude: 20, longitude: -103, accuracyMeters: 80 } }, true, 50).result, "LOW_ACCURACY");
});

test("disabled branches skip location; enabled but broken configuration fails closed", () => {
  assert.equal(requiresLocation({ ...branch, geofenceEnabled: false }, true), false);
  assert.equal(requiresLocation({ geofenceEnabled: true, geofence: null }, true), true);
  assert.equal(evaluateGeofence({ geofenceEnabled: true, geofence: null }, null, true, 100).result, "UNAVAILABLE");
  assert.equal(evaluateGeofence(branch, null, false, 50).result, "NOT_REQUIRED");
});

test("outside policy can block or allow with a review exception", () => {
  assert.deepEqual(geofenceDecision("OUTSIDE", "BLOCK"), { allow: false, needsReview: false });
  assert.deepEqual(geofenceDecision("OUTSIDE", "ALLOW_WITH_EXCEPTION"), { allow: true, needsReview: true });
});

test("geofence result labels stay human and do not expose protocol values", () => {
  assert.equal(geofenceResultLabel("INSIDE"), "Dentro de la sucursal");
  assert.equal(geofenceResultLabel("OUTSIDE"), "Fuera de la geozona");
  assert.equal(geofenceResultLabel("PERMISSION_DENIED"), "Permiso de ubicación rechazado");
  assert.equal(geofenceResultLabel("LOW_ACCURACY"), "Ubicación imprecisa");
  assert.equal(geofenceResultLabel("UNAVAILABLE"), "Ubicación no disponible");
});
