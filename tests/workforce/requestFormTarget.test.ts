import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { requestKindToCorrection } from "../../lib/workforce/clock/requestPresentation";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/workforce/requests/RequestForm.tsx"),
  "utf8",
);

test("event-required requests block submission without a selected event", () => {
  assert.match(source, /name="targetClockEventId" value=\{targetId\}/);
  assert.match(source, /name="targetClockEventId"[\s\S]*?required className=/);
});

test("event-required requests submit the selected event value", () => {
  assert.match(source, /name="targetClockEventId"[^>]*value=\{targetId\}/);
  assert.doesNotMatch(source, /type="hidden" name="targetClockEventId"/);
});

test("request types without an event keep omitting the event field", () => {
  assert.equal(requestKindToCorrection("MISSING_CLOCK_IN").requiresTarget, false);
  assert.equal(requestKindToCorrection("MISSING_CLOCK_OUT").requiresTarget, false);
  assert.doesNotMatch(source, /type="hidden" name="targetClockEventId"/);
});
