import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { formatPaymentMoney, parsePaymentAmount, periodRange, shiftPeriodAnchor, validDateOnly } from "../lib/accounting";
import { allocatePayrollEntries } from "../lib/accounting/payrollAllocation";
import { getModuleKeyForPath, isAdminOnlyPath, isConfigurablePermissionKey } from "../lib/permission-modules";
import { MAIN_MODULES, SUBMENUS, isMainModuleVisible } from "../components/layout/navigation";

test("periodos contables respetan fechas civiles, lunes y años bisiestos", () => {
  assert.deepEqual(periodRange("day", "2026-10-12"), { from: "2026-10-12", to: "2026-10-12" });
  assert.deepEqual(periodRange("week", "2026-10-18"), { from: "2026-10-12", to: "2026-10-18" });
  assert.deepEqual(periodRange("month", "2024-02-20"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(periodRange("year", "2026-10-12"), { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(validDateOnly("2026-02-30"), false);
});

test("la navegación contable cambia al periodo anterior y siguiente", () => {
  assert.equal(shiftPeriodAnchor("day", "2026-10-13", -1), "2026-10-12");
  assert.equal(shiftPeriodAnchor("week", "2026-10-13", 1), "2026-10-19");
  assert.equal(shiftPeriodAnchor("month", "2026-10-13", -1), "2026-09-01");
  assert.equal(shiftPeriodAnchor("year", "2026-10-13", 1), "2027-01-01");
});

test("la nómina histórica se asigna a la sucursal desde el snapshot del turno", () => {
  const result = allocatePayrollEntries([{
    totalPay: "1100.00",
    basePay: "1000.00",
    overtimePay: "0.00",
    daysSnapshot: [{ entries: [{ branchId: "canoas", pay: 500 }, { branchId: "otra", pay: 500 }] }],
  }], "canoas");
  assert.equal(result.amount, 550);
  assert.equal(result.entriesWithBranchPay, 1);
  assert.equal(result.unallocated, 0);
});

test("importe de pago acepta centavos y rechaza valores inválidos", () => {
  assert.equal(parsePaymentAmount(" 123.45 "), "123.45");
  for (const value of ["0", "-2", "1.999", "1e3", "1000000000000", "abc"]) {
    assert.equal(parsePaymentAmount(value), null, value);
  }
});

test("los totales conservan centavos sin sumar flotantes", () => {
  assert.equal(formatPaymentMoney(new Prisma.Decimal("0.1").plus("0.2")), "$0.30");
  assert.equal(formatPaymentMoney("1234567890.45"), "$1,234,567,890.45");
});

test("Contabilidad está reservada a administradores", () => {
  assert.equal(getModuleKeyForPath("/accounting"), "/accounting");
  assert.equal(getModuleKeyForPath("/accounting/anything"), "/accounting");
  assert.equal(isAdminOnlyPath("/accounting"), true);
  assert.equal(isAdminOnlyPath("/accounting/anything"), true);
  assert.equal(isConfigurablePermissionKey("/accounting"), false);
  assert.equal(SUBMENUS.accounting[0]?.href, "/accounting");
  const accountingModule = MAIN_MODULES.find((item) => item.module === "accounting");
  assert.ok(accountingModule);
  assert.equal(isMainModuleVisible("GERENTE", ["/accounting"], accountingModule), false);
  assert.equal(isMainModuleVisible("ADMIN", [], accountingModule), true);
  assert.equal(isMainModuleVisible("GERENTE", ["/cash-cuts"], accountingModule), false);
});
