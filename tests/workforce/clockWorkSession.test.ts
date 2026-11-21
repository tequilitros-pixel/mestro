import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEffectiveClockStream,
  type EffectiveClockCorrection,
  type ObservedClockEvent,
} from "../../lib/workforce/clock/effectiveStream";
import {
  allowedClockTypes,
  assertTransition,
  clockState,
  reconstructWorkSessions,
} from "../../lib/workforce/clock/reconstruction";
const at = (v: string) => new Date(v);
const observed = (
  id: string,
  type: ObservedClockEvent["type"],
  time: string,
  branchId = "b1",
): ObservedClockEvent => ({
  id,
  employmentId: "e1",
  branchId,
  type,
  occurredAt: at(time),
});
const correction = (
  v: Partial<EffectiveClockCorrection>,
): EffectiveClockCorrection => ({
  id: "c1",
  employmentId: "e1",
  requestedAt: at("2026-09-01T19:00:00Z"),
  status: "APPROVED",
  type: "ADD_MISSING_EVENT",
  branchId: "b1",
  proposedEventType: "CLOCK_OUT",
  proposedOccurredAt: at("2026-09-01T18:00:00Z"),
  ...v,
});

test("a final ADD correction can be compensated without mutation", () => {
  const added = correction({
    id: "add-1",
    proposedEventType: "CLOCK_IN",
    proposedOccurredAt: at("2026-09-01T09:00:00Z"),
  });
  const stream = buildEffectiveClockStream([], [
    added,
    correction({
      id: "void-1",
      requestedAt: at("2026-09-01T20:00:00Z"),
      type: "VOID_EVENT",
      targetCorrectionId: added.id,
      branchId: null,
      proposedEventType: null,
      proposedOccurredAt: null,
    }),
  ]);
  assert.deepEqual(stream, []);
});
test("valid transitions expose only valid actions", () => {
  assert.deepEqual(allowedClockTypes("NO_SESSION"), ["CLOCK_IN"]);
  assert.deepEqual(allowedClockTypes("ON_BREAK"), ["BREAK_END"]);
});
test("invalid clock out is rejected", () =>
  assert.throws(
    () => assertTransition("NO_SESSION", "CLOCK_OUT"),
    /INVALID_TRANSITION/,
  ));
test("double clock in is rejected", () =>
  assert.throws(
    () => assertTransition("CLOCKED_IN", "CLOCK_IN"),
    /INVALID_TRANSITION/,
  ));
test("double break start is rejected", () =>
  assert.throws(
    () => assertTransition("ON_BREAK", "BREAK_START"),
    /INVALID_TRANSITION/,
  ));
test("state machine reaches break and returns", () =>
  assert.equal(
    clockState(
      buildEffectiveClockStream(
        [
          observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
          observed("2", "BREAK_START", "2026-09-01T12:00:00Z"),
          observed("3", "BREAK_END", "2026-09-01T12:30:00Z"),
        ],
        [],
      ),
    ),
    "CLOCKED_IN",
  ));
test("normal WorkSession calculates work", () => {
  const s = reconstructWorkSessions(
    buildEffectiveClockStream(
      [
        observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
        observed("2", "CLOCK_OUT", "2026-09-01T17:00:00Z"),
      ],
      [],
    ),
  )[0];
  assert.deepEqual(
    { status: s.status, worked: s.workedMinutes, breaks: s.breakMinutes },
    { status: "COMPLETE", worked: 480, breaks: 0 },
  );
});
test("one break is excluded", () => {
  const s = reconstructWorkSessions(
    buildEffectiveClockStream(
      [
        observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
        observed("2", "BREAK_START", "2026-09-01T12:00:00Z"),
        observed("3", "BREAK_END", "2026-09-01T12:30:00Z"),
        observed("4", "CLOCK_OUT", "2026-09-01T17:00:00Z"),
      ],
      [],
    ),
  )[0];
  assert.equal(s.workedMinutes, 450);
  assert.equal(s.breakMinutes, 30);
});
test("multiple breaks accumulate", () => {
  const events = [
    observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
    observed("2", "BREAK_START", "2026-09-01T11:00:00Z"),
    observed("3", "BREAK_END", "2026-09-01T11:15:00Z"),
    observed("4", "BREAK_START", "2026-09-01T14:00:00Z"),
    observed("5", "BREAK_END", "2026-09-01T14:20:00Z"),
    observed("6", "CLOCK_OUT", "2026-09-01T17:00:00Z"),
  ];
  assert.equal(
    reconstructWorkSessions(buildEffectiveClockStream(events, []))[0]
      .breakMinutes,
    35,
  );
});
test("incomplete break is INCOMPLETE", () =>
  assert.equal(
    reconstructWorkSessions(
      buildEffectiveClockStream(
        [
          observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
          observed("2", "BREAK_START", "2026-09-01T12:00:00Z"),
        ],
        [],
      ),
    )[0].status,
    "INCOMPLETE",
  ));
test("missing clock out remains OPEN", () =>
  assert.equal(
    reconstructWorkSessions(
      buildEffectiveClockStream(
        [observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z")],
        [],
      ),
    )[0].status,
    "OPEN",
  ));
test("overnight session remains one session", () =>
  assert.equal(
    reconstructWorkSessions(
      buildEffectiveClockStream(
        [
          observed("1", "CLOCK_IN", "2026-09-01T23:00:00Z"),
          observed("2", "CLOCK_OUT", "2026-09-02T07:00:00Z"),
        ],
        [],
      ),
    )[0].workedMinutes,
    480,
  ));
test("ADD_MISSING_EVENT supplies clock out", () =>
  assert.equal(
    reconstructWorkSessions(
      buildEffectiveClockStream(
        [observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z")],
        [correction({})],
      ),
    )[0].status,
    "COMPLETE",
  ));
test("MODIFY_OCCURRED_TIME changes effective time", () => {
  const stream = buildEffectiveClockStream(
    [
      observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
      observed("2", "CLOCK_OUT", "2026-09-01T18:00:00Z"),
    ],
    [
      correction({
        type: "MODIFY_OCCURRED_TIME",
        targetClockEventId: "2",
        proposedOccurredAt: at("2026-09-01T17:00:00Z"),
      }),
    ],
  );
  assert.equal(stream[1].occurredAt.toISOString(), "2026-09-01T17:00:00.000Z");
});
test("VOID_EVENT removes observed duplicate", () => {
  const stream = buildEffectiveClockStream(
    [
      observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z"),
      observed("2", "CLOCK_IN", "2026-09-01T09:00:01Z"),
    ],
    [correction({ type: "VOID_EVENT", targetClockEventId: "2" })],
  );
  assert.equal(stream.length, 1);
});
for (const status of ["PENDING", "REJECTED"] as const)
  test(`${status} correction is ignored`, () =>
    assert.equal(
      buildEffectiveClockStream(
        [observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z")],
        [correction({ status })],
      ).length,
      1,
    ));
test("same timestamp ordering is deterministic", () => {
  const stream = buildEffectiveClockStream(
    [
      observed("out", "CLOCK_OUT", "2026-09-01T09:00:00Z"),
      observed("in", "CLOCK_IN", "2026-09-01T09:00:00Z"),
    ],
    [],
  );
  assert.deepEqual(
    stream.map((e) => e.type),
    ["CLOCK_IN", "CLOCK_OUT"],
  );
});
test("observed events remain unchanged", () => {
  const event = observed("1", "CLOCK_IN", "2026-09-01T09:00:00Z");
  const before = event.occurredAt.getTime();
  buildEffectiveClockStream(
    [event],
    [
      correction({
        type: "MODIFY_OCCURRED_TIME",
        targetClockEventId: "1",
        proposedOccurredAt: at("2026-09-01T10:00:00Z"),
      }),
    ],
  );
  assert.equal(event.occurredAt.getTime(), before);
});
