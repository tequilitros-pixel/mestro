import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("employee clock surfaces never start continuous location tracking", () => {
  const personalClock = readFileSync("app/workforce/clock/ClockActionForm.tsx", "utf8");
  const kioskClock = readFileSync("app/workforce/kiosk/KioskClockForm.tsx", "utf8");
  assert.match(personalClock, /getCurrentPosition/);
  assert.equal(personalClock.includes("watchPosition"), false);
  assert.equal(kioskClock.includes("watchPosition"), false);
  assert.match(kioskClock, /getCurrentPosition/);
});

test("clock evidence stores validation metadata but not employee coordinates", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const evidenceModel = schema.match(/model ClockGeolocationEvidence \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(evidenceModel, /result\s+GeofenceValidationResult/);
  assert.match(evidenceModel, /distanceMeters\s+Int\?/);
  assert.match(evidenceModel, /accuracyMeters\s+Float\?/);
  assert.doesNotMatch(evidenceModel, /\blatitude\b|\blongitude\b/);
});
