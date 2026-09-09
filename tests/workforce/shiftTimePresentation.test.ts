import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBusinessDateOnly,
  formatBusinessTime,
} from "../../lib/dateTime";

test("Canoas 10:00-17:00 is identical in scheduler and employee presentation", () => {
  // These are the exact instants currently persisted for Eduardo/Canoas.
  const startAt = new Date("2026-09-09T16:00:00.000Z");
  const endAt = new Date("2026-09-09T23:00:00.000Z");

  const scheduler = [formatBusinessTime(startAt), formatBusinessTime(endAt)];
  const employee = [formatBusinessTime(startAt), formatBusinessTime(endAt)];

  assert.deepEqual(scheduler, ["10:00", "17:00"]);
  assert.deepEqual(employee, ["10:00", "17:00"]);
  assert.deepEqual(employee, scheduler);
  assert.notDeepEqual(employee, ["16:00", "23:00"]);
});

test("night shift 17:00-01:00 preserves the next business date", () => {
  const startAt = new Date("2026-09-09T23:00:00.000Z");
  const endAt = new Date("2026-09-10T07:00:00.000Z");

  assert.equal(formatBusinessTime(startAt), "17:00");
  assert.equal(formatBusinessTime(endAt), "01:00");
  assert.equal(formatBusinessDateOnly(startAt), "2026-09-09");
  assert.equal(formatBusinessDateOnly(endAt), "2026-09-10");
});
