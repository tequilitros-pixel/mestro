import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("legacy geofence route redirects to the canonical branch geofence management page", () => {
  const config = readFileSync("next.config.ts", "utf8");

  assert.match(
    config,
    /source:\s*"\/timeclock\/geofences",\s*destination:\s*"\/administration\/workforce\/branches"/,
  );
});
