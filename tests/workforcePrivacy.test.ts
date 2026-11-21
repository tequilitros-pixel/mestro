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

test("employee Clock and Kiosk do not expose break controls", () => {
  const clockPage = readFileSync("app/workforce/clock/page.tsx", "utf8");
  const clockStatus = readFileSync("app/workforce/clock/ClockStatus.tsx", "utf8");
  const clockAction = readFileSync("app/workforce/clock/ClockActionForm.tsx", "utf8");
  const kioskClock = readFileSync("app/workforce/kiosk/KioskClockForm.tsx", "utf8");
  const visibleClock = [clockPage, clockStatus, clockAction, kioskClock].join("\n");
  assert.doesNotMatch(visibleClock, /Iniciar descanso|Terminar descanso|Descanso en curso|BREAK_START|BREAK_END/);
});

test("clock evidence stores validation metadata but not employee coordinates", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const evidenceModel = schema.match(/model ClockGeolocationEvidence \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(evidenceModel, /result\s+GeofenceValidationResult/);
  assert.match(evidenceModel, /distanceMeters\s+Int\?/);
  assert.match(evidenceModel, /accuracyMeters\s+Float\?/);
  assert.doesNotMatch(evidenceModel, /\blatitude\b|\blongitude\b/);
});

test("legacy clock and geofence routes delegate to Workforce canonical flows", () => {
  const clock = readFileSync("app/timeclock/page.tsx", "utf8");
  const kiosk = readFileSync("app/timeclock/kiosk/page.tsx", "utf8");
  const geofences = readFileSync("app/timeclock/geofences/page.tsx", "utf8");
  assert.match(clock, /redirect\("\/workforce\/clock"\)/);
  assert.match(kiosk, /redirect\("\/workforce\/kiosk"\)/);
  assert.match(geofences, /redirect\("\/administration\/workforce\/branches"\)/);
  assert.doesNotMatch(clock, /watchPosition/);
  assert.doesNotMatch(kiosk, /getCurrentPosition/);
});
