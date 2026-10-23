import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSchedulingBranchAccess,
  availabilityWarning,
  calculateCoverage,
  coverageStatus,
  localDateTimeToInstant,
  overtimeRisk,
  scheduledHours,
  shiftInstants,
  validateShiftFacts,
  windowsOverlap,
} from "../../lib/workforce/scheduling/rules";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const window = (
  start: string,
  end: string,
  employmentId: string | null = "e1",
  branchId = "b1",
) => ({
  employmentId,
  branchId,
  businessDate: date("2026-09-05"),
  startAt: new Date(start),
  endAt: new Date(end),
  status: "DRAFT",
});

test("normal local shift becomes absolute instants", () => {
  const result = shiftInstants({
    businessDate: date("2026-09-01"),
    startTime: "09:00",
    endTime: "17:00",
    timezone: "America/Mexico_City",
  });
  assert.equal(result.startAt.toISOString(), "2026-09-01T15:00:00.000Z");
});
test("overnight shift ends next day", () => {
  const result = shiftInstants({
    businessDate: date("2026-09-05"),
    startTime: "18:00",
    endTime: "01:00",
    timezone: "America/Mexico_City",
  });
  assert.equal(result.endAt.toISOString(), "2026-09-06T07:00:00.000Z");
});
test("invalid time is rejected", () =>
  assert.throws(
    () => localDateTimeToInstant(date("2026-09-01"), "25:00", "UTC"),
    /Hora inválida/,
  ));
test("adjacent shifts do not overlap", () =>
  assert.equal(
    windowsOverlap(
      window("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
      window("2026-09-01T12:00:00Z", "2026-09-01T14:00:00Z"),
    ),
    false,
  ));
test("same-branch overlap is detected", () =>
  assert.equal(
    windowsOverlap(
      window("2026-09-01T10:00:00Z", "2026-09-01T13:00:00Z"),
      window("2026-09-01T12:00:00Z", "2026-09-01T14:00:00Z"),
    ),
    true,
  ));
test("cross-branch overlap is detected by instants", () =>
  assert.equal(
    windowsOverlap(
      window("2026-09-01T10:00:00Z", "2026-09-01T13:00:00Z", "e1", "a"),
      window("2026-09-01T12:00:00Z", "2026-09-01T14:00:00Z", "e1", "b"),
    ),
    true,
  ));
test("unassigned shift is a warning, not blocker", () =>
  assert.deepEqual(
    validateShiftFacts({
      shift: window("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z", null),
      periodStart: date("2026-09-01"),
      periodEnd: date("2026-09-07"),
    }),
    { blockers: [], warnings: ["UNASSIGNED"] },
  ));
test("inactive employment blocks", () =>
  assert.ok(
    validateShiftFacts({
      shift: window("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
      periodStart: date("2026-09-01"),
      periodEnd: date("2026-09-07"),
      employmentStatus: "INACTIVE",
      branchAuthorized: true,
      overlaps: false,
    }).blockers.includes("INACTIVE_EMPLOYMENT"),
  ));
test("unauthorized branch blocks", () =>
  assert.ok(
    validateShiftFacts({
      shift: window("2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
      periodStart: date("2026-09-01"),
      periodEnd: date("2026-09-07"),
      employmentStatus: "ACTIVE",
      branchAuthorized: false,
      overlaps: false,
    }).blockers.includes("UNAUTHORIZED_BRANCH"),
  ));
test("outside period blocks", () =>
  assert.ok(
    validateShiftFacts({
      shift: {
        ...window("2026-09-08T10:00:00Z", "2026-09-08T12:00:00Z"),
        businessDate: date("2026-09-08"),
      },
      periodStart: date("2026-09-01"),
      periodEnd: date("2026-09-07"),
      employmentStatus: "ACTIVE",
      branchAuthorized: true,
      overlaps: false,
    }).blockers.includes("OUTSIDE_PERIOD"),
  ));
test("UNAVAILABLE produces warning", () =>
  assert.equal(
    availabilityWarning({
      state: "UNAVAILABLE",
      startTime: null,
      endTime: null,
      source: "RECURRING",
      reason: null,
    }),
    "UNAVAILABLE",
  ));
test("UNKNOWN produces informational warning", () =>
  assert.equal(
    availabilityWarning({
      state: "UNKNOWN",
      startTime: null,
      endTime: null,
      source: "NONE",
      reason: "NO_AVAILABILITY_DECLARED",
    }),
    "UNKNOWN_AVAILABILITY",
  ));
test("scheduled hours ignore cancelled and group employee", () =>
  assert.equal(
    scheduledHours([
      window("2026-09-01T10:00:00Z", "2026-09-01T18:00:00Z"),
      {
        ...window("2026-09-02T10:00:00Z", "2026-09-02T18:00:00Z"),
        status: "CANCELLED",
      },
    ]).get("e1"),
    8,
  ));
test("overtime risk uses configurable threshold", () =>
  assert.deepEqual(overtimeRisk(50, 48), {
    risk: true,
    hours: 50,
    threshold: 48,
    excessHours: 2,
  }));
test("coverage distinguishes under, exact and over", () => {
  assert.equal(coverageStatus(4, 3).status, "UNDERSTAFFED");
  assert.equal(coverageStatus(4, 4).status, "COVERED");
  assert.equal(coverageStatus(4, 5).status, "OVERSTAFFED");
});
test("coverage counts overlapping shifts", () =>
  assert.equal(
    calculateCoverage(
      {
        startAt: new Date("2026-09-01T10:00:00Z"),
        endAt: new Date("2026-09-01T14:00:00Z"),
        requiredCount: 2,
      },
      [
        window("2026-09-01T09:00:00Z", "2026-09-01T11:00:00Z"),
        window("2026-09-01T13:00:00Z", "2026-09-01T15:00:00Z"),
        window("2026-09-01T15:00:00Z", "2026-09-01T16:00:00Z"),
      ],
    ).scheduled,
    2,
  ));
test("admin has all branch access", () =>
  assert.doesNotThrow(() => assertSchedulingBranchAccess("ADMIN", null, "b1")));
test("scoped manager cannot modify another branch", () =>
  assert.throws(
    () => assertSchedulingBranchAccess("GERENTE", ["b1"], "b2"),
    /No autorizado/,
  ));
