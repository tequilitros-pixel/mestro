import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAttendance, canAccessAttendanceBranch } from "../../lib/workforce/attendance/evaluate";
import { DEFAULT_ATTENDANCE_POLICY } from "../../lib/workforce/attendance/policy";
import type { AttendanceSession, AttendanceShift } from "../../lib/workforce/attendance/types";

const at = (hour: number, minute = 0, day = 1) =>
  new Date(Date.UTC(2026, 8, day, hour, minute));
const shift = (value: Partial<AttendanceShift> = {}): AttendanceShift => ({
  id: "shift-1",
  employmentId: "employment-1",
  branchId: "branch-1",
  businessDate: at(0),
  startAt: at(9),
  endAt: at(17),
  status: "PUBLISHED",
  ...value,
});
const session = (value: Partial<AttendanceSession> = {}): AttendanceSession => ({
  id: "session-1",
  employmentId: "employment-1",
  branchId: "branch-1",
  businessDate: at(0),
  shiftId: "shift-1",
  startedAt: at(9),
  endedAt: at(17),
  breakMinutes: 30,
  status: "COMPLETE",
  ...value,
});
const types = (
  shifts: AttendanceShift[],
  sessions: AttendanceSession[],
  now = at(20),
) =>
  evaluateAttendance({
    shifts,
    sessions,
    policy: DEFAULT_ATTENDANCE_POLICY,
    now,
  }).expected.map((item) => item.type);

test("on-time session has no exception", () =>
  assert.deepEqual(types([shift()], [session()]), []));
test("late inside grace has no exception", () =>
  assert.deepEqual(types([shift()], [session({ startedAt: at(9, 5) })]), []));
test("late beyond grace captures minutes", () => {
  const result = evaluateAttendance({ shifts: [shift()], sessions: [session({ startedAt: at(9, 13) })], policy: DEFAULT_ATTENDANCE_POLICY, now: at(20) }).expected;
  assert.deepEqual({ type: result[0].type, difference: result[0].differenceMinutes }, { type: "LATE_ARRIVAL", difference: 13 });
});
test("early departure beyond grace is detected", () =>
  assert.deepEqual(types([shift()], [session({ endedAt: at(16, 50) })]), ["EARLY_DEPARTURE"]));
test("no-show waits for threshold", () =>
  assert.deepEqual(types([shift()], [], at(9, 29)), []));
test("no-show after threshold is critical", () => {
  const result = evaluateAttendance({ shifts: [shift()], sessions: [], policy: DEFAULT_ATTENDANCE_POLICY, now: at(9, 30) }).expected[0];
  assert.deepEqual({ type: result.type, severity: result.severity }, { type: "NO_SHOW", severity: "CRITICAL" });
});
test("future shift is not a no-show", () =>
  assert.deepEqual(types([shift()], [], at(8)), []));
test("unassigned shift is not an employee no-show", () =>
  assert.deepEqual(types([shift({ employmentId: null })], [], at(20)), []));
test("cancelled shift is not a no-show", () =>
  assert.deepEqual(types([shift({ status: "CANCELLED" })], [], at(20)), []));
test("work against cancelled shift becomes unscheduled", () =>
  assert.deepEqual(types([shift({ status: "CANCELLED" })], [session()]), ["UNSCHEDULED_WORK"]));
test("session without shift is unscheduled", () =>
  assert.deepEqual(types([], [session({ shiftId: null })]), ["UNSCHEDULED_WORK"]));
test("active open session has no premature missing-out", () =>
  assert.deepEqual(types([shift()], [session({ endedAt: null, status: "OPEN" })], at(17, 30)), []));
test("open session after cutoff has missing-out", () =>
  assert.deepEqual(types([shift()], [session({ endedAt: null, status: "OPEN" })], at(18)), ["MISSING_CLOCK_OUT"]));
test("missing start is distinguished from no-show", () =>
  assert.ok(types([shift()], [session({ startedAt: null, status: "INCOMPLETE" })]).includes("MISSING_CLOCK_IN")));
test("incomplete break remains explicit", () =>
  assert.ok(types([shift()], [session({ endedAt: null, status: "INCOMPLETE" })]).includes("INCOMPLETE_BREAK")));
test("long break uses the configured threshold", () =>
  assert.deepEqual(types([shift()], [session({ breakMinutes: 61 })]), ["LONG_BREAK"]));
test("overnight calculations use absolute instants and original business date", () => {
  const overnight = shift({ startAt: at(18, 0, 5), endAt: at(1, 0, 6), businessDate: at(0, 0, 5) });
  const actual = session({ startedAt: at(18, 10, 5), endedAt: at(0, 50, 6), businessDate: at(0, 0, 5) });
  const result = evaluateAttendance({ shifts: [overnight], sessions: [actual], policy: DEFAULT_ATTENDANCE_POLICY, now: at(3, 0, 6) }).expected;
  assert.deepEqual(result.map((item) => item.type), ["EARLY_DEPARTURE", "LATE_ARRIVAL"]);
  assert.equal(result[0].businessDate.toISOString(), at(0, 0, 5).toISOString());
});
test("effective shift revision changes the comparison", () => {
  const actual = session({ startedAt: at(9, 10) });
  assert.ok(types([shift()], [actual]).includes("LATE_ARRIVAL"));
  assert.ok(!types([shift({ startAt: at(9, 10) })], [actual]).includes("LATE_ARRIVAL"));
});
test("branch authorization supports ADMIN and scoped managers", () => {
  assert.equal(canAccessAttendanceBranch("ADMIN", null, "b1"), true);
  assert.equal(canAccessAttendanceBranch("MANAGER", ["b1"], "b1"), true);
  assert.equal(canAccessAttendanceBranch("MANAGER", ["b2"], "b1"), false);
});
