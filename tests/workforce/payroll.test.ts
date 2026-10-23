import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  assertPayrollAdmin, calculatePayrollMoney, canReadPayrollStatement, effectivePayRateBlocker, payrollReadiness,
} from "../../lib/workforce/payroll/rules";

const day = (date: string, rate: string, ordinaryMinutes: number, doubleMinutes = 0, tripleMinutes = 0) => ({
  businessDate: new Date(`${date}T00:00:00.000Z`), payRateId: `rate-${date}`,
  rateType: "HOURLY" as const, rate: new Prisma.Decimal(rate), currency: "MXN",
  ordinaryMinutes, doubleMinutes, tripleMinutes,
});

test("explicit 40 ordinary + 9 double + 1 triple financial example", () => {
  const result = calculatePayrollMoney([day("2030-06-03", "60", 2400, 540, 60)], [
    { direction: "EARNING", amount: "200" }, { direction: "DEDUCTION", amount: "100" },
  ]);
  assert.deepEqual({
    ordinary: result.ordinaryPay.toFixed(2), double: result.doublePay.toFixed(2),
    triple: result.triplePay.toFixed(2), gross: result.grossAmount.toFixed(2),
    payable: result.operationalPayable.toFixed(2),
  }, { ordinary: "2400.00", double: "1080.00", triple: "180.00", gross: "3860.00", payable: "3760.00" });
});

test("midweek rate change prices each daily overtime segment", () => {
  const result = calculatePayrollMoney([
    day("2030-06-03", "60", 480), day("2030-06-04", "60", 480), day("2030-06-05", "60", 480),
    day("2030-06-06", "65", 480, 540, 60), day("2030-06-07", "65", 480),
  ]);
  assert.deepEqual({ ordinary: result.ordinaryPay.toFixed(2), double: result.doublePay.toFixed(2), triple: result.triplePay.toFixed(2), gross: result.grossAmount.toFixed(2) },
    { ordinary: "2480.00", double: "1170.00", triple: "195.00", gross: "3845.00" });
});

test("component rounding is deterministic half-up to cents", () => {
  const result = calculatePayrollMoney([day("2030-06-03", "60.01", 1, 1, 1)]);
  assert.deepEqual([result.ordinaryPay.toFixed(2), result.doublePay.toFixed(2), result.triplePay.toFixed(2)], ["1.00", "2.00", "3.00"]);
});
test("fractional-cent components round half-up and reconcile without floating point", () => {
  const result = calculatePayrollMoney([day("2030-06-03", "10.01", 1, 1, 1)]);
  assert.deepEqual({ ordinary: result.ordinaryPay.toFixed(2), double: result.doublePay.toFixed(2), triple: result.triplePay.toFixed(2), gross: result.grossAmount.toFixed(2) },
    { ordinary: "0.17", double: "0.33", triple: "0.50", gross: "1.00" });
  assert.equal(result.operationalPayable.toFixed(2), "1.00");
});
test("approved zero-work source produces an explainable zero result", () => {
  const result = calculatePayrollMoney([day("2030-06-03", "60", 0)]);
  assert.equal(result.operationalPayable.toFixed(2), "0.00");
  assert.equal(result.ordinaryMinutes, 0);
});
test("NIGHT finalized overtime minutes are priced without reclassification", () => {
  const finalizedNight = day("2030-06-03", "60", 420, 120, 30);
  const result = calculatePayrollMoney([finalizedNight]);
  assert.deepEqual([result.ordinaryPay.toFixed(2), result.doublePay.toFixed(2), result.triplePay.toFixed(2)], ["420.00", "240.00", "90.00"]);
});
test("MIXED finalized overtime minutes are priced without reclassification", () => {
  const finalizedMixed = day("2030-06-03", "60", 450, 90, 30);
  const result = calculatePayrollMoney([finalizedMixed]);
  assert.deepEqual([result.ordinaryPay.toFixed(2), result.doublePay.toFixed(2), result.triplePay.toFixed(2)], ["450.00", "180.00", "90.00"]);
});
test("branch identity cannot split canonical Employment-period payroll money", () => {
  const branchA = { ...day("2030-06-03", "60", 480), branchId: "branch-a" };
  const branchB = { ...day("2030-06-04", "60", 480), branchId: "branch-b" };
  const result = calculatePayrollMoney([branchA, branchB]);
  assert.equal(result.ordinaryMinutes, 960);
  assert.equal(result.ordinaryPay.toFixed(2), "960.00");
});
test("money invariant is gross plus no hidden difference", () => {
  const result = calculatePayrollMoney([day("2030-06-03", "10", 60)], [{ direction: "EARNING", amount: "5" }, { direction: "DEDUCTION", amount: "3" }]);
  assert.equal(result.operationalPayable.toFixed(2), result.grossAmount.sub(result.deductionsAmount).toFixed(2));
});
test("deductions cannot silently create negative payroll", () =>
  assert.throws(() => calculatePayrollMoney([day("2030-06-03", "10", 60)], [{ direction: "DEDUCTION", amount: "11" }]), /NEGATIVE_PAYABLE/));
test("unsupported compensation type blocks", () =>
  assert.throws(() => calculatePayrollMoney([{ ...day("2030-06-03", "60", 480), rateType: "SALARY" }]), /UNSUPPORTED_RATE_TYPE/));
test("currency mismatch blocks", () =>
  assert.throws(() => calculatePayrollMoney([day("2030-06-03", "60", 480), { ...day("2030-06-04", "60", 480), currency: "USD" }]), /CURRENCY_MISMATCH/));
test("readiness derives from blockers", () => { assert.equal(payrollReadiness([]), "READY"); assert.equal(payrollReadiness(["MISSING_RATE"]), "BLOCKED"); });
test("missing and overlapping effective PayRates block explicitly", () => {
  assert.equal(effectivePayRateBlocker([]), "PAY_RATE_MISSING");
  assert.equal(effectivePayRateBlocker([{ rateType:"HOURLY",currency:"MXN" },{ rateType:"HOURLY",currency:"MXN" }]), "PAY_RATE_OVERLAP");
});
test("payroll management is ADMIN only", () => { assert.equal(assertPayrollAdmin({ role: "ADMIN" }).role, "ADMIN"); assert.throws(() => assertPayrollAdmin({ role: "EMPLOYEE" }), /No autorizado/); assert.throws(() => assertPayrollAdmin(null), /No autorizado/); });
test("employee statement ownership is exact", () => { assert.equal(canReadPayrollStatement("u1", "u1"), true); assert.equal(canReadPayrollStatement("u2", "u1"), false); });
