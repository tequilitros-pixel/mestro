import assert from "node:assert/strict";
import test from "node:test";
import { shouldClosePayrollPeriodOnReceipt } from "../lib/payroll/receiptSettlement";

test("firma parcial paga al empleado pero no cierra la semana", () => {
  assert.equal(shouldClosePayrollPeriodOnReceipt("APROBADA", 6, 2), false);
});
test("la última firma cierra la semana automáticamente", () => {
  assert.equal(shouldClosePayrollPeriodOnReceipt("APROBADA", 6, 0), true);
});
test("un compañero aún en revisión impide cerrar la semana", () => {
  assert.equal(shouldClosePayrollPeriodOnReceipt("REVISION", 6, 1), false);
});
test("sin recibos no puede crear una semana pagada", () => {
  assert.equal(shouldClosePayrollPeriodOnReceipt("APROBADA", 0, 0), false);
});
test("una semana ya pagada nunca se vuelve a sellar", () => {
  assert.equal(shouldClosePayrollPeriodOnReceipt("PAGADA", 6, 0), false);
});
