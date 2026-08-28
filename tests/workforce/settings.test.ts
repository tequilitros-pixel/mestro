import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ATTENDANCE_POLICY } from "../../lib/workforce/attendance/policy";
import { evaluateAttendance } from "../../lib/workforce/attendance/evaluate";
import {
  assertUnscheduledWorkPolicy,
  shiftLinkProximityMilliseconds,
} from "../../lib/workforce/clock/policy";
import { overtimeRisk } from "../../lib/workforce/scheduling/rules";
import { DEFAULT_WORKFORCE_POLICY } from "../../lib/workforce/settings/defaults";
import {
  assertCanManageWorkforceSettings,
  assertWorkforcePolicy,
  resolveEffectivePolicy,
} from "../../lib/workforce/settings/rules";

const editable = () => {
  const { version: _version, effectiveFrom: _effectiveFrom, legalPolicyCode: _code, ...values } = DEFAULT_WORKFORCE_POLICY;
  void [_version, _effectiveFrom, _code];
  return { ...values };
};

test("default settings preserve approved attendance behavior", () => {
  assert.deepEqual(
    {
      lateGraceMinutes: DEFAULT_WORKFORCE_POLICY.lateGraceMinutes,
      earlyDepartureGraceMinutes: DEFAULT_WORKFORCE_POLICY.earlyDepartureGraceMinutes,
      longBreakThresholdMinutes: DEFAULT_WORKFORCE_POLICY.longBreakThresholdMinutes,
      noShowThresholdMinutes: DEFAULT_WORKFORCE_POLICY.noShowThresholdMinutes,
      missingClockOutThresholdMinutes: DEFAULT_WORKFORCE_POLICY.missingClockOutThresholdMinutes,
    },
    DEFAULT_ATTENDANCE_POLICY,
  );
});
test("default scheduling threshold remains 48 hours", () =>
  assert.equal(DEFAULT_WORKFORCE_POLICY.scheduledHoursWarningMinutes, 48 * 60));
test("effective-date resolution preserves historical version", () => {
  const v1 = { version: 1, effectiveFrom: new Date("2026-01-01") };
  const v2 = { version: 2, effectiveFrom: new Date("2026-09-01") };
  assert.equal(resolveEffectivePolicy([v1, v2], new Date("2026-08-31")).version, 1);
  assert.equal(resolveEffectivePolicy([v1, v2], new Date("2026-09-01")).version, 2);
});
test("negative operational value is rejected", () =>
  assert.throws(() => assertWorkforcePolicy({ ...editable(), lateGraceMinutes: -1 }), /lateGraceMinutes/));
test("absurd threshold is rejected", () =>
  assert.throws(() => assertWorkforcePolicy({ ...editable(), noShowThresholdMinutes: 1441 }), /noShowThresholdMinutes/));
test("invalid pay day is rejected", () =>
  assert.throws(() => assertWorkforcePolicy({ ...editable(), payDay: 7 }), /pago/));
test("week invariant remains Monday", () =>
  assert.throws(() => assertWorkforcePolicy({ ...editable(), payWeekStartsOn: 0 }), /lunes/));
test("valid customized attendance policy passes", () =>
  assert.equal(assertWorkforcePolicy({ ...editable(), lateGraceMinutes: 10 }).lateGraceMinutes, 10));

test("settings management accepts ADMIN only", () => {
  assert.equal(assertCanManageWorkforceSettings({ role: "ADMIN" }).role, "ADMIN");
  assert.throws(() => assertCanManageWorkforceSettings({ role: "EMPLOYEE" }), /No autorizado/);
  assert.throws(() => assertCanManageWorkforceSettings(null), /No autorizado/);
});

test("Attendance consumes the configured grace policy", () => {
  const startAt = new Date("2026-09-01T09:00:00.000Z");
  const result = evaluateAttendance({
    shifts: [{
      id: "shift", employmentId: "employment", branchId: "branch",
      businessDate: new Date("2026-09-01T00:00:00.000Z"), startAt,
      endAt: new Date("2026-09-01T17:00:00.000Z"), status: "PUBLISHED",
    }],
    sessions: [{
      id: "session", employmentId: "employment", branchId: "branch",
      businessDate: new Date("2026-09-01T00:00:00.000Z"), shiftId: "shift",
      startedAt: new Date("2026-09-01T09:08:00.000Z"),
      endedAt: new Date("2026-09-01T17:00:00.000Z"), breakMinutes: 30,
      status: "COMPLETE",
    }],
    policy: { ...DEFAULT_ATTENDANCE_POLICY, lateGraceMinutes: 10 },
    now: new Date("2026-09-01T20:00:00.000Z"),
  });
  assert.deepEqual(result.expected, []);
});

test("Scheduling consumes the configured warning threshold", () => {
  assert.equal(overtimeRisk(41, 40).risk, true);
  assert.equal(overtimeRisk(41, 48).risk, false);
});

test("Clock consumes proximity and unscheduled-work policy", () => {
  assert.equal(shiftLinkProximityMilliseconds(15), 900_000);
  assert.doesNotThrow(() => assertUnscheduledWorkPolicy({
    eventType: "CLOCK_IN", allowUnscheduledWork: true, hasMatchingShift: false,
  }));
  assert.throws(() => assertUnscheduledWorkPolicy({
    eventType: "CLOCK_IN", allowUnscheduledWork: false, hasMatchingShift: false,
  }), /deshabilitado por política/);
  assert.doesNotThrow(() => assertUnscheduledWorkPolicy({
    eventType: "CLOCK_IN", allowUnscheduledWork: false, hasMatchingShift: true,
  }));
});
