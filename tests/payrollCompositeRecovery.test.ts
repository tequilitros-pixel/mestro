import assert from "node:assert/strict";
import test from "node:test";
import { calculateCompositeSalary } from "../lib/payroll/compositeSalary";
import { calculatePayrollSupplement, reconcilePayrollReceipt } from "../lib/payroll/contractualSupplement";

test("conserva tarifa por hora y suma un adicional contractual del 12% sin duplicarlo", () => {
  const baseHourlyRate = 48;
  const additional = calculatePayrollSupplement(baseHourlyRate, 12);
  assert.equal(additional.total, 5.76);
  assert.equal(additional.aguinaldoReference, 2.88);
  assert.equal(additional.vacationsReference, 2.30);
  assert.equal(additional.vacationPremiumReference, 0.58);
  assert.equal(baseHourlyRate + additional.total, 53.76);
  const receipt = reconcilePayrollReceipt(48, 0, 5.76, [], 53.76);
  assert.equal(receipt.matchesApproved, true);
  assert.equal(receipt.computedTotal, 53.76);
});

test("la referencia proporcional de prestaciones no se confunde con el porcentaje contratado", () => {
  const reference = calculateCompositeSalary(48, 40);
  assert.equal(reference.baseHourlyRate, 48);
  assert.equal(reference.aguinaldoHourly + reference.vacacionesHourly + reference.primaVacacionalHourly > 0, true);
  assert.equal(reference.totalHourlyRate, 51.94);
});
