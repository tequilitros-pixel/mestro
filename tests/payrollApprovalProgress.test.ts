import assert from "node:assert/strict";
import test from "node:test";
import { payrollApprovalProgress } from "../lib/payroll/approvalProgress";

test("el saldo baja solo al aprobar y conserva centavos en una reaprobación", () => {
  const rows = [
    { finalPay: 1250.35, approval: { status: "APROBADA" as const } },
    { finalPay: 870.10, approval: { status: "REVISION" as const } },
  ];
  assert.deepEqual(payrollApprovalProgress(rows), { approved: 1250.35, remaining: 870.1 });

  rows[1] = { finalPay: 920.15, approval: { status: "APROBADA" as const } };
  assert.deepEqual(payrollApprovalProgress(rows), { approved: 2170.5, remaining: 0 });
});
