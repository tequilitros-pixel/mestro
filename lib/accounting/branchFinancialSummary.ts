export type BranchFinancialSummaryInput = {
  sales: number;
  saleCount: number;
  payroll: number;
  cashOutflows: number;
  accountingPayments: number;
  inventoryActualCost: number;
  inventoryActualCostKnown: boolean;
  inventoryTheoreticalCost: number;
  inventoryTheoreticalCostKnown: boolean;
};

export type BranchFinancialSummary = {
  sales: number;
  saleCount: number;
  payroll: number;
  cashOutflows: number;
  accountingPayments: number;
  otherExpenses: number;
  inventory: {
    actualCost: number;
    actualCostKnown: boolean;
    theoreticalCost: number;
    theoreticalCostKnown: boolean;
  };
  registeredExpenses: number;
  theoreticalExpenses: number;
  registeredResult: number;
  theoreticalResult: number;
  registeredResultComplete: boolean;
  theoreticalResultComplete: boolean;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Une las fuentes ya registradas de una sucursal sin crear movimientos.
 * El costo real del inventario y el costo teórico se conservan separados
 * para que el resultado no oculte una valuación pendiente.
 */
export function summarizeBranchFinancials(input: BranchFinancialSummaryInput): BranchFinancialSummary {
  const otherExpenses = money(input.cashOutflows + input.accountingPayments);
  const nonInventoryExpenses = money(input.payroll + otherExpenses);
  const registeredExpenses = money(nonInventoryExpenses + input.inventoryActualCost);
  const theoreticalExpenses = money(nonInventoryExpenses + input.inventoryTheoreticalCost);

  return {
    sales: money(input.sales),
    saleCount: input.saleCount,
    payroll: money(input.payroll),
    cashOutflows: money(input.cashOutflows),
    accountingPayments: money(input.accountingPayments),
    otherExpenses,
    inventory: {
      actualCost: money(input.inventoryActualCost),
      actualCostKnown: input.inventoryActualCostKnown,
      theoreticalCost: money(input.inventoryTheoreticalCost),
      theoreticalCostKnown: input.inventoryTheoreticalCostKnown,
    },
    registeredExpenses,
    theoreticalExpenses,
    registeredResult: money(input.sales - registeredExpenses),
    theoreticalResult: money(input.sales - theoreticalExpenses),
    registeredResultComplete: input.inventoryActualCostKnown,
    theoreticalResultComplete: input.inventoryTheoreticalCostKnown,
  };
}
