import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateWeek,
  dateKey,
  formatMinutes,
  mondayOf,
  sundayOf,
  timesheetReadiness,
} from "../../lib/workforce/timesheet/rules";

const at = (day: number, hour = 0) => new Date(Date.UTC(2026, 7, day, hour));
const session = (value: Record<string, unknown> = {}) => ({
  id: "s1",
  businessDate: at(24),
  workedMinutes: 480,
  breakMinutes: 30,
  status: "COMPLETE" as const,
  branchId: "b1",
  ...value,
});
const week = (sessions = [session()], issues: Array<Record<string, unknown>> = []) =>
  aggregateWeek({
    periodStart: at(24),
    sessions: sessions as never,
    shifts: [],
    issues: issues as never,
  });

test("week is Monday through Sunday", () => {
  const monday = mondayOf(at(27));
  assert.equal(dateKey(monday), "2026-08-24");
  assert.equal(dateKey(sundayOf(monday)), "2026-08-30");
});
test("daily aggregation stores integer worked minutes", () =>
  assert.equal(week()[0].workedMinutes, 480));
test("multiple same-day sessions aggregate into one line", () =>
  assert.deepEqual(
    { minutes: week([session(), session({ id: "s2", workedMinutes: 120 })])[0].workedMinutes, count: week([session(), session({ id: "s2" })])[0].sessionCount },
    { minutes: 600, count: 2 },
  ));
test("overnight remains on original business date", () =>
  assert.equal(week([session({ businessDate: at(29), workedMinutes: 420 })])[5].workedMinutes, 420));
test("multi-branch sessions aggregate in the employment week", () =>
  assert.equal(week([session(), session({ id: "s2", branchId: "b2", workedMinutes: 60 })])[0].workedMinutes, 540));
test("unscheduled session is still included", () =>
  assert.equal(week([session({ id: "unscheduled" })])[0].workedMinutes, 480));
test("incomplete session marks day for review", () =>
  assert.equal(week([session({ status: "INCOMPLETE" })])[0].needsReview, true));
test("open attendance warning marks review without blocking", () => {
  const line = week([session()], [{ businessDate: at(24), type: "LATE_ARRIVAL", severity: "WARNING", status: "OPEN" }])[0];
  assert.deepEqual({ review: line.needsReview, blocked: line.blocking }, { review: true, blocked: false });
});
test("critical missing clock blocks", () => {
  const line = week([session()], [{ businessDate: at(24), type: "MISSING_CLOCK_OUT", severity: "CRITICAL", status: "OPEN" }])[0];
  assert.equal(line.blocking, true);
});
test("resolved attendance does not affect readiness", () =>
  assert.equal(week([session()], [{ businessDate: at(24), type: "MISSING_CLOCK_OUT", severity: "CRITICAL", status: "RESOLVED" }])[0].needsReview, false));
test("scheduled minutes are informational", () => {
  const result = aggregateWeek({ periodStart: at(24), sessions: [], shifts: [{ businessDate: at(24), startAt: at(24, 9), endAt: at(24, 17), status: "PUBLISHED" }], issues: [] });
  assert.equal(result[0].scheduledMinutes, 480);
});
test("readiness prioritizes blocked", () =>
  assert.equal(timesheetReadiness([{ needsReview: true, blocking: true }]), "BLOCKED"));
test("warnings produce needs review", () =>
  assert.equal(timesheetReadiness([{ needsReview: true, blocking: false }]), "NEEDS_REVIEW"));
test("clean week is ready", () =>
  assert.equal(timesheetReadiness([{ needsReview: false, blocking: false }]), "READY"));
test("hours display does not use floating point", () => {
  assert.equal(formatMinutes(495), "8h 15m");
  assert.equal(formatMinutes(-15), "−0h 15m");
});
