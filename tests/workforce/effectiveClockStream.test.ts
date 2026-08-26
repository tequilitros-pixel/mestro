import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEffectiveClockStream,
  type EffectiveClockCorrection,
  type ObservedClockEvent,
} from "./effectiveClockStream";

const clockIn: ObservedClockEvent = {
  id: "observed-in",
  type: "CLOCK_IN",
  occurredAt: new Date("2099-01-06T23:02:00.000Z"),
};

test("approved missing punch supplies an effective event", () => {
  const corrections: EffectiveClockCorrection[] = [
    {
      id: "missing-out",
      status: "APPROVED",
      type: "ADD_MISSING_EVENT",
      proposedEventType: "CLOCK_OUT",
      proposedOccurredAt: new Date("2099-01-07T07:05:00.000Z"),
    },
  ];
  const stream = buildEffectiveClockStream([clockIn], corrections);
  assert.deepEqual(stream.map((event) => event.type), ["CLOCK_IN", "CLOCK_OUT"]);
  assert.equal(stream[1].source, "CORRECTION");
  assert.equal(stream[1].originalClockEventId, null);
});

test("approved void excludes a duplicate without deleting observations", () => {
  const duplicate = {
    ...clockIn,
    id: "observed-duplicate",
    occurredAt: new Date("2099-01-06T23:02:05.000Z"),
  };
  const stream = buildEffectiveClockStream([clockIn, duplicate], [
    {
      id: "void-duplicate",
      status: "APPROVED",
      type: "VOID_EVENT",
      targetClockEventId: duplicate.id,
    },
  ]);
  assert.deepEqual(stream.map((event) => event.originalClockEventId), [clockIn.id]);
});

test("approved modification preserves the original identity and changes effective time", () => {
  const clockOut: ObservedClockEvent = {
    id: "observed-out",
    type: "CLOCK_OUT",
    occurredAt: new Date("2099-01-07T07:20:00.000Z"),
  };
  const stream = buildEffectiveClockStream([clockIn, clockOut], [
    {
      id: "modify-out",
      status: "APPROVED",
      type: "MODIFY_OCCURRED_TIME",
      targetClockEventId: clockOut.id,
      proposedOccurredAt: new Date("2099-01-07T07:05:00.000Z"),
    },
  ]);
  assert.equal(stream[1].originalClockEventId, clockOut.id);
  assert.equal(stream[1].occurredAt.toISOString(), "2099-01-07T07:05:00.000Z");
});

for (const status of ["PENDING", "REJECTED"] as const) {
  test(`${status.toLowerCase()} correction has no effect`, () => {
    const stream = buildEffectiveClockStream([clockIn], [
      {
        id: `${status}-correction`,
        status,
        type: "ADD_MISSING_EVENT",
        proposedEventType: "CLOCK_OUT",
        proposedOccurredAt: new Date("2099-01-07T07:05:00.000Z"),
      },
    ]);
    assert.equal(stream.length, 1);
    assert.equal(stream[0].source, "OBSERVED");
  });
}
