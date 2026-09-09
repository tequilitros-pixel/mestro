import assert from "node:assert/strict";
import test from "node:test";

import { parseLocalDateTimeInZone } from "../../lib/workforce/clock/localDateTime";

test("uses the IANA branch timezone for local correction times", () => {
  assert.equal(
    parseLocalDateTimeInZone("2026-09-08T21:37", "America/Mexico_City").toISOString(),
    "2026-09-09T03:37:00.000Z",
  );
});

test("preserves the local date across midnight conversion", () => {
  assert.equal(
    parseLocalDateTimeInZone("2026-09-08T23:59", "America/Mexico_City").toISOString(),
    "2026-09-09T05:59:00.000Z",
  );
});
