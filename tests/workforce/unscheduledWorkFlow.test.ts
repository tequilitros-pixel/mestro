import test from "node:test";
import assert from "node:assert/strict";

import {
  reconstructWorkSessions,
} from "../../lib/workforce/clock/reconstruction";
import { evaluateAttendance } from "../../lib/workforce/attendance/evaluate";
import { DEFAULT_ATTENDANCE_POLICY } from "../../lib/workforce/attendance/policy";
import {
  aggregateWeek,
  mondayOf,
  timesheetReadiness,
} from "../../lib/workforce/timesheet/rules";

test("unscheduled clock flow reaches needs-review timesheet readiness", () => {
  const employmentId = "emp-1";
  const branchId = "branch-1";
  const occurredIn = new Date("2026-09-07T14:00:00.000Z");
  const occurredOut = new Date("2026-09-07T22:00:00.000Z");

  const sessions = reconstructWorkSessions([
    {
      id: "evt-in",
      employmentId,
      branchId,
      occurredAt: occurredIn,
      type: "CLOCK_IN",
      sourceId: "evt-in",
    } as never,
    {
      id: "evt-out",
      employmentId,
      branchId,
      occurredAt: occurredOut,
      type: "CLOCK_OUT",
      sourceId: "evt-out",
    } as never,
  ]);

  const session = sessions[0];
  const businessDate = new Date("2026-09-07T00:00:00.000Z");
  const attendance = evaluateAttendance({
    shifts: [],
    sessions: [
      {
        id: session.key,
        businessDate,
        workedMinutes: session.workedMinutes,
        breakMinutes: session.breakMinutes,
        status: session.status,
        branchId,
        employmentId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      } as never,
    ],
    policy: DEFAULT_ATTENDANCE_POLICY,
    now: new Date("2026-09-08T02:00:00.000Z"),
  });

  assert.equal(attendance.expected.length, 1);
  assert.equal(attendance.expected[0].type, "UNSCHEDULED_WORK");

  const periodStart = mondayOf(businessDate);
  const aggregates = aggregateWeek({
    periodStart,
    sessions: [
      {
        id: session.key,
        businessDate,
        workedMinutes: session.workedMinutes,
        breakMinutes: session.breakMinutes,
        status: session.status,
        branchId,
      } as never,
    ],
    shifts: [],
    issues: attendance.expected.map((item) => ({
      businessDate: item.businessDate,
      type: item.type,
      severity: item.severity,
      status: "OPEN",
    }) as never),
  });
  const readiness = timesheetReadiness(
    aggregates.map((day) => ({ needsReview: day.needsReview, blocking: day.blocking })),
  );

  assert.equal(aggregates[0].workedMinutes, 480);
  assert.equal(readiness, "NEEDS_REVIEW");
});
