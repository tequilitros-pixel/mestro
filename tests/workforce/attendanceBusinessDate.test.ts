import test from "node:test";
import assert from "node:assert/strict";
import { dateKey, localBusinessDate } from "../../lib/workforce/attendance/businessDate";

test("attendance business date follows America/Mexico_City near midnight", () => {
  const beforeLocalMidnight = new Date("2026-09-09T05:59:00.000Z");
  const afterLocalMidnight = new Date("2026-09-09T06:01:00.000Z");

  assert.equal(dateKey(localBusinessDate(beforeLocalMidnight, "America/Mexico_City")), "2026-09-08");
  assert.equal(dateKey(localBusinessDate(afterLocalMidnight, "America/Mexico_City")), "2026-09-09");
});
