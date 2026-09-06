import assert from "node:assert/strict";
import test from "node:test";
import {
  rangesOverlap,
  shiftRangeMinutes,
  validBreakMinutes,
  validTemplateWeekday,
} from "@/lib/workforce/scheduleTemplate";

test("template weekdays are limited to Monday through Sunday", () => {
  assert.equal(validTemplateWeekday(0), true);
  assert.equal(validTemplateWeekday(6), true);
  assert.equal(validTemplateWeekday(-1), false);
  assert.equal(validTemplateWeekday(7), false);
  assert.equal(validTemplateWeekday(1.5), false);
});

test("template break minutes reject negative, fractional and excessive values", () => {
  assert.equal(validBreakMinutes(0), true);
  assert.equal(validBreakMinutes(30), true);
  assert.equal(validBreakMinutes(720), true);
  assert.equal(validBreakMinutes(-1), false);
  assert.equal(validBreakMinutes(30.5), false);
  assert.equal(validBreakMinutes(721), false);
});

test("template time ranges support overnight shifts", () => {
  assert.deepEqual(shiftRangeMinutes("17:00", "01:00"), [1020, 1500]);
  assert.deepEqual(shiftRangeMinutes("10:00", "18:00"), [600, 1080]);
});

test("multiple blocks may share a day only when they do not overlap", () => {
  assert.equal(rangesOverlap(shiftRangeMinutes("09:00", "13:00"), shiftRangeMinutes("13:00", "17:00")), false);
  assert.equal(rangesOverlap(shiftRangeMinutes("09:00", "14:00"), shiftRangeMinutes("13:00", "17:00")), true);
});
