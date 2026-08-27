import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeRateCoverage,
  comparePayrollEntry,
  compareWorkedMinutes,
  editRequestToCorrectionCandidate,
  overtimeToTimesheetCandidate,
  salaryRateToPayRateCandidate,
  scheduledShiftToCandidate,
  scheduleWeekToPeriodCandidates,
  timeClockEntryToWorkSessionCandidate,
  userToIdentityCandidate,
} from "../../lib/workforce/legacy/bridge";

test("User maps to identity candidates without invented employment history", () => {
  const result = userToIdentityCandidate({ id: "u1", name: "Synthetic Person", active: true });
  assert.equal(result.classification, "AUTO_MIGRATION_WITH_NULL_UNKNOWN");
  assert.equal(result.candidate?.employment.startedAt, null);
  assert.equal(result.candidate?.firstName, null);
  assert.ok(result.issues.some((item) => item.field === "employment.startedAt"));
});

test("SalaryRate preserves amount, type and range while leaving currency unknown", () => {
  const result = salaryRateToPayRateCandidate({
    id: "rate1",
    userId: "u1",
    scheme: "HORA",
    amount: 125,
    effectiveFrom: new Date("2099-01-01T00:00:00Z"),
    effectiveTo: null,
  });
  assert.equal(result.candidate?.rateType, "HOURLY");
  assert.equal(result.candidate?.amount, 125);
  assert.equal(result.candidate?.currency, null);
});

test("rate coverage reports gaps and overlaps", () => {
  const base = { userId: "u1", scheme: "HORA" as const, amount: 100 };
  const issues = analyzeRateCoverage([
    { ...base, id: "a", effectiveFrom: new Date("2099-01-01"), effectiveTo: new Date("2099-02-01") },
    { ...base, id: "b", effectiveFrom: new Date("2099-01-20"), effectiveTo: new Date("2099-03-01") },
    { ...base, id: "c", effectiveFrom: new Date("2099-04-01"), effectiveTo: null },
  ]);
  assert.deepEqual(issues.map((item) => item.category), ["CONFLICTING_DATA", "MISSING_DATA"]);
});

test("overnight ScheduledShift maps to absolute instants and keeps business date", () => {
  const result = scheduledShiftToCandidate(
    {
      id: "shift1",
      userId: "u1",
      branchId: "b1",
      date: new Date("2099-01-05T00:00:00Z"),
      type: "TURNO",
      startTime: "23:00",
      endTime: "03:00",
    },
    "America/Mexico_City",
  );
  assert.equal(result.candidate?.businessDate, "2099-01-05");
  assert.equal(result.candidate?.endAt.getTime()! > result.candidate?.startAt.getTime()!, true);
  assert.equal(result.candidate?.publicationHistory, "UNKNOWN");
});

test("ScheduleWeek becomes branch periods without invented publication revisions", () => {
  const shift = {
    id: "shift1",
    userId: "u1",
    branchId: "b1",
    date: new Date("2099-01-05T00:00:00Z"),
    type: "TURNO" as const,
    startTime: "17:00",
    endTime: "23:00",
  };
  const result = scheduleWeekToPeriodCandidates(
    { id: "week1", weekStart: new Date("2099-01-05"), status: "PUBLISHED", publishedAt: null, publishedById: null },
    [shift],
    new Map([["b1", "America/Mexico_City"]]),
  );
  assert.equal(result.candidate?.length, 1);
  assert.equal(result.candidate?.[0].publicationHistory, "UNKNOWN");
});

test("TimeClockEntry maps to a composite WorkSession candidate, not fake events", () => {
  const result = timeClockEntryToWorkSessionCandidate(
    {
      id: "clock1",
      userId: "u1",
      branchId: "b1",
      clockIn: new Date("2099-01-06T05:00:00Z"),
      clockOut: new Date("2099-01-06T09:00:00Z"),
      source: "CHECADOR",
      scheduledShiftId: "shift1",
    },
    "America/Mexico_City",
    "2099-01-05",
  );
  assert.equal(result.candidate?.source, "LEGACY_COMPOSITE_ENTRY");
  assert.equal(result.candidate?.workedMinutes, 240);
  assert.equal(result.candidate?.businessDate, "2099-01-05");
  assert.equal(result.candidate?.originalClockEventsAvailable, false);
});

test("missing clock-out edit request maps to an ADD_MISSING_EVENT candidate", () => {
  const result = editRequestToCorrectionCandidate({
    id: "edit1",
    timeClockId: "clock1",
    originalClockIn: new Date("2099-01-05T23:00:00Z"),
    originalClockOut: null,
    requestedClockIn: new Date("2099-01-05T23:00:00Z"),
    requestedClockOut: new Date("2099-01-06T07:00:00Z"),
    status: "APROBADO",
    reason: "Synthetic missing punch",
  });
  assert.equal(result.candidate?.type, "ADD_MISSING_EVENT");
  assert.equal(result.candidate?.status, "APPROVED");
  assert.equal(result.candidate?.targetClockEventId, null);
});

test("compound edit request requires manual review", () => {
  const result = editRequestToCorrectionCandidate({
    id: "edit2",
    timeClockId: "clock2",
    originalClockIn: new Date("2099-01-05T23:00:00Z"),
    originalClockOut: new Date("2099-01-06T07:00:00Z"),
    requestedClockIn: new Date("2099-01-05T23:05:00Z"),
    requestedClockOut: new Date("2099-01-06T07:05:00Z"),
    status: "APROBADO",
    reason: null,
  });
  assert.equal(result.candidate, null);
  assert.equal(result.classification, "REQUIRES_REVIEW");
});

test("OvertimeRecord maps hours to structural minute tiers", () => {
  const candidate = overtimeToTimesheetCandidate({
    id: "ot1",
    userId: "u1",
    weekStart: new Date("2099-01-05"),
    overtimeHours: 10,
    doubleHours: 9,
    tripleHours: 1,
    status: "APROBADO",
  });
  assert.equal(candidate.overtimeMinutes, 600);
  assert.equal(candidate.overtimeTier1Minutes, 540);
  assert.equal(candidate.overtimeTier2Minutes, 60);
});

test("PayrollEntry comparison separates parity from policy differences", () => {
  const entry = {
    id: "pay1",
    userId: "u1",
    regularHours: 40,
    overtimeHours: 2,
    totalHours: 42,
    basePay: 4_000,
    overtimePay: 400,
    adjustmentsTotal: 100,
    totalPay: 4_500,
  };
  assert.equal(comparePayrollEntry(entry, 4_500).category, "EXPECTED");
  assert.equal(comparePayrollEntry(entry, 4_400).category, "POLICY_DIFFERENCE");
});

test("worked-minute comparison has zero silent mismatches", () => {
  assert.equal(compareWorkedMinutes(480, 480).category, "EXPECTED");
  assert.equal(compareWorkedMinutes(480, 479).category, "MAPPING_BUG");
});
