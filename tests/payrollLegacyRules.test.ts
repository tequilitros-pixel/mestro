import assert from "node:assert/strict";
import test from "node:test";
import {
  computeHourlyPay,
  payrollBusinessDate,
  payrollWeekInstantRange,
} from "../lib/payroll/legacyRules";

test("una entrada del jueves por la noche pertenece al jueves de Mexico", () => {
  assert.equal(payrollBusinessDate(new Date("2026-09-18T01:00:00.000Z")), "2026-09-17");
});

test("la nomina paga todas las horas a la tarifa normal sin recargo", () => {
  assert.equal(computeHourlyPay(47.5, 100), 4750);
  assert.equal(computeHourlyPay(50, null), 0);
});

test("la semana de nomina usa medianoches locales como limites UTC", () => {
  const range = payrollWeekInstantRange("2026-09-14");
  assert.equal(range.start.toISOString(), "2026-09-14T06:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-21T06:00:00.000Z");
});

test("el pago base por registro se redondea a centavos sin una deduccion adicional", () => {
  assert.equal(computeHourlyPay(1 / 3, 40), 13.33);
  assert.equal(computeHourlyPay(2 / 3, 40), 26.67);
  assert.equal(computeHourlyPay(0.1, 44.8), 4.48);
  assert.equal(computeHourlyPay(1, 40) + computeHourlyPay(1, 4.8), 44.8);
});
