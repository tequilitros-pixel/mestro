import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBranchFinancials } from "../../lib/accounting/branchFinancialSummary";

test("el resumen financiero conserva por separado el costo registrado y el teórico", () => {
  const summary = summarizeBranchFinancials({
    sales: 1000,
    saleCount: 8,
    payroll: 200,
    cashOutflows: 50,
    accountingPayments: 100,
    inventoryActualCost: 300,
    inventoryActualCostKnown: true,
    inventoryTheoreticalCost: 280,
    inventoryTheoreticalCostKnown: false,
  });

  assert.equal(summary.otherExpenses, 150);
  assert.equal(summary.registeredExpenses, 650);
  assert.equal(summary.registeredResult, 350);
  assert.equal(summary.theoreticalExpenses, 630);
  assert.equal(summary.theoreticalResult, 370);
  assert.equal(summary.registeredResultComplete, true);
  assert.equal(summary.theoreticalResultComplete, false);
});
