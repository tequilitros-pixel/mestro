import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayrollSupplement, effectiveSupplementPercent, sumPayrollSupplements, supplementFromSnapshotAdjustments, isPayrollRoundingDeduction, reconcilePayrollReceipt } from "../lib/payroll/contractualSupplement";

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

test("centavos del adicional se distribuyen sin reducir el total calculado", () => {
  for (let cents = 1; cents <= 1000; cents++) {
    const result = calculatePayrollSupplement(cents / 100, 12);
    const parts = [result.aguinaldoReference, result.vacationsReference, result.vacationPremiumReference];
    assert.ok(parts.every((value) => value >= 0), `ningun concepto resta: ${cents}`);
    assert.equal(Math.round(parts.reduce((sum, value) => sum + value, 0) * 100), Math.round(result.total * 100));
    assert.equal(Math.round(result.total * 100), Math.round(cents * 0.12));
  }
});
test("no permitir un ajuste de centavos como deduccion oculta", () => {
  assert.equal(isPayrollRoundingDeduction("Ajuste de centavos"), true);
  assert.equal(isPayrollRoundingDeduction("Ajuste por redondeo"), true);
  assert.equal(isPayrollRoundingDeduction("Bono de puntualidad"), false);
});

test("rechaza ajuste de centavos disfrazado como complemento con notas", () => {
  assert.equal(isPayrollRoundingDeduction("Ajustes / Complementos de Nómina; Ajuste de centavos / incidencias del periodo"), true);
  assert.equal(isPayrollRoundingDeduction("Vacaciones proporcionales"), false);
});
test("recibo sin deduccion artificial: $1908.33 + $144 son $2052.33", () => {
  const correct = reconcilePayrollReceipt(1908.33, 0, 144, [], 2052.33);
  assert.equal(correct.computedTotal, 2052.33);
  assert.equal(correct.matchesApproved, true);
  const artificial = reconcilePayrollReceipt(1908.33, 0, 144, [], 1908.33);
  assert.equal(artificial.matchesApproved, false);
});
test("expediente historico aprobado sin adicional mantiene su importe", () => {
  const result = reconcilePayrollReceipt(1908.33, 0, 0, [], 1908.33);
  assert.equal(result.matchesApproved, true);
  assert.equal(result.deductions, 0);
});
