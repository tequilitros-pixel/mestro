import test from "node:test";
import assert from "node:assert/strict";
import { classifyOvertimeWeek } from "../../lib/workforce/overtime/rules";

const DAY = 86_400_000;
const monday = new Date("2026-06-01T00:00:00.000Z");
const legalPolicy = {
  version: "MX_OVERTIME_V1_2026",
  ordinaryDailyLimitMinutes: { DAY: 480, NIGHT: 420, MIXED: 450 },
  weeklyDoubleLimitMinutes: 540,
} as const;
const policy = (jornadaType: "DAY" | "NIGHT" | "MIXED" = "DAY") => [{ id: jornadaType, jornadaType, effectiveFrom: new Date("2020-01-01"), effectiveTo: null }];
const calculate = (minutes: number[], jornadaType: "DAY" | "NIGHT" | "MIXED" = "DAY") => classifyOvertimeWeek({
  legalPolicy,
  jornadaPolicies: policy(jornadaType),
  lines: Array.from({ length: 7 }, (_, index) => ({ timesheetLineId: `l${index}`, businessDate: new Date(monday.getTime() + index * DAY), approvedMinutes: minutes[index] ?? 0 })),
});

test("DAY exact ordinary limit", () => {
  const line = calculate([480]).lines[0];
  assert.deepEqual({ ordinary: line.ordinaryMinutes, double: line.doubleMinutes, triple: line.tripleMinutes }, { ordinary: 480, double: 0, triple: 0 });
});
test("one minute overtime is double", () => assert.deepEqual({ ordinary: calculate([481]).ordinaryMinutes, double: calculate([481]).doubleMinutes }, { ordinary: 480, double: 1 }));
test("NIGHT uses seven-hour daily limit", () => assert.deepEqual({ ordinary: calculate([480], "NIGHT").ordinaryMinutes, double: calculate([480], "NIGHT").doubleMinutes }, { ordinary: 420, double: 60 }));
test("MIXED uses seven-and-a-half-hour daily limit", () => assert.deepEqual({ ordinary: calculate([480], "MIXED").ordinaryMinutes, double: calculate([480], "MIXED").doubleMinutes }, { ordinary: 450, double: 30 }));
test("exactly nine overtime hours remain double", () => assert.deepEqual({ double: calculate([600, 600, 600, 600, 540]).doubleMinutes, triple: calculate([600, 600, 600, 600, 540]).tripleMinutes }, { double: 540, triple: 0 }));
test("nine hours plus one minute makes one triple minute", () => assert.deepEqual({ double: calculate([600, 600, 600, 600, 541]).doubleMinutes, triple: calculate([600, 600, 600, 600, 541]).tripleMinutes }, { double: 540, triple: 1 }));
test("one day splits across double and triple boundary", () => {
  const result = calculate([600, 600, 600, 600, 660]);
  assert.deepEqual({ double: result.lines[4].doubleMinutes, triple: result.lines[4].tripleMinutes }, { double: 60, triple: 120 });
});
test("50-hour example reconciles 40 ordinary, 9 double, 1 triple", () => {
  const result = calculate([600, 600, 600, 600, 600, 0, 0]);
  assert.deepEqual({ approved: result.approvedMinutes, ordinary: result.ordinaryMinutes, double: result.doubleMinutes, triple: result.tripleMinutes }, { approved: 3000, ordinary: 2400, double: 540, triple: 60 });
});
test("positive Timesheet adjustment is already part of effective line", () => assert.deepEqual({ ordinary: calculate([510]).ordinaryMinutes, double: calculate([510]).doubleMinutes }, { ordinary: 480, double: 30 }));
test("negative Timesheet adjustment reduces effective line", () => assert.deepEqual({ ordinary: calculate([450]).ordinaryMinutes, double: calculate([450]).doubleMinutes }, { ordinary: 450, double: 0 }));
test("Monday-Sunday ordering is deterministic", () => {
  const result = classifyOvertimeWeek({ legalPolicy, jornadaPolicies: policy(), lines: [2, 0, 1].map((index) => ({ timesheetLineId: `l${index}`, businessDate: new Date(monday.getTime() + index * DAY), approvedMinutes: 600 })) });
  assert.deepEqual(result.lines.map((line) => line.timesheetLineId), ["l0", "l1", "l2"]);
});
test("jornada can change honestly by business date", () => {
  const result = classifyOvertimeWeek({ legalPolicy, jornadaPolicies: [{ id: "day", jornadaType: "DAY", effectiveFrom: monday, effectiveTo: monday }, { id: "night", jornadaType: "NIGHT", effectiveFrom: new Date(monday.getTime() + DAY), effectiveTo: null }], lines: [{ timesheetLineId: "m", businessDate: monday, approvedMinutes: 480 }, { timesheetLineId: "t", businessDate: new Date(monday.getTime() + DAY), approvedMinutes: 480 }] });
  assert.deepEqual(result.lines.map((line) => line.ordinaryMinutes), [480, 420]);
});
test("missing jornada blocks instead of guessing", () => assert.throws(() => classifyOvertimeWeek({ legalPolicy, jornadaPolicies: [], lines: [{ timesheetLineId: "m", businessDate: monday, approvedMinutes: 1 }] }), /JORNADA_POLICY_MISSING/));
test("overlapping jornada blocks instead of guessing", () => assert.throws(() => classifyOvertimeWeek({ legalPolicy, jornadaPolicies: [...policy(), ...policy("NIGHT")], lines: [{ timesheetLineId: "m", businessDate: monday, approvedMinutes: 1 }] }), /JORNADA_POLICY_OVERLAP/));
test("minute reconciliation invariant holds for varied week", () => {
  const result = calculate([0, 1, 479, 480, 481, 900, 120]);
  assert.equal(result.ordinaryMinutes + result.doubleMinutes + result.tripleMinutes, result.approvedMinutes);
});
