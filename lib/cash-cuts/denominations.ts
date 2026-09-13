export const CASH_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5] as const;

export type CashDenominationCount = { value: number; quantity: number };

export function denominationTotal(rows: CashDenominationCount[]): number {
  return rows.reduce((sum, row) => sum + row.value * row.quantity, 0);
}

export function validDenominationRows(input: unknown): CashDenominationCount[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<number>(CASH_DENOMINATIONS);
  return input
    .filter((row): row is CashDenominationCount =>
      typeof row?.value === "number" &&
      allowed.has(row.value) &&
      typeof row.quantity === "number" &&
      Number.isInteger(row.quantity) &&
      row.quantity > 0,
    )
    .map((row) => ({ value: row.value, quantity: row.quantity }));
}

export function remainingCashFund(cashCounted: number, envelopeAmount: number): number {
  return Math.max(0, cashCounted - envelopeAmount);
}
