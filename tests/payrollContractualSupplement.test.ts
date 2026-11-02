import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayrollSupplement, effectiveSupplementPercent, sumPayrollSupplements, supplementFromSnapshotAdjustments } from "../lib/payroll/contractualSupplement";

test("anexo de contrato: 40 pesos/h, 40 horas, adicional 12%", () => {
  const b = calculatePayrollSupplement(1600, 12);
  assert.deepEqual(b, { aguinaldoReference: 96, vacationsReference: 76.8, vacationPremiumReference: 19.2, total: 192 });
  assert.equal(1600 + b.total, 1792);
});
test("sin configuración no se altera el sueldo", () => {
  assert.equal(calculatePayrollSupplement(1600, 0).total, 0);
  assert.equal(calculatePayrollSupplement(0, 12).total, 0);
});
test("paga el adicional por turno con redondeo consistente", () => {
  const b = sumPayrollSupplements([calculatePayrollSupplement(320, 12), calculatePayrollSupplement(320, 12)]);
  assert.equal(b.total, 76.8);
});
test("tasa histórica no se aplica antes de su vigencia", () => {
  const r = [{ percent: 12, effectiveFrom: new Date("2026-11-02T15:00:00Z"), effectiveTo: null }];
  assert.equal(effectiveSupplementPercent(r, new Date("2026-10-20T10:00:00Z")), 0);
  assert.equal(effectiveSupplementPercent(r, new Date("2026-11-03T10:00:00Z")), 12);
});
test("snapshot antiguo sin adicional no se reinterpreta", () => {
  assert.equal(supplementFromSnapshotAdjustments([{ concept: "Bono", amount: 100 }]).total, 0);
});
