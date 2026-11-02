/**
 * Adicional contractual por hora. No es un cálculo de liquidación legal:
 * las tres etiquetas son referencias de costo del anexo contractual.
 * El pago no extingue por sí solo aguinaldo, vacaciones ni prima.
 */
export type PayrollSupplementBreakdown = {
  aguinaldoReference: number;
  vacationsReference: number;
  vacationPremiumReference: number;
  total: number;
};
export const EMPTY_PAYROLL_SUPPLEMENT: PayrollSupplementBreakdown = {
  aguinaldoReference: 0, vacationsReference: 0, vacationPremiumReference: 0, total: 0,
};
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function calculatePayrollSupplement(basePay: number, percent: number | null): PayrollSupplementBreakdown {
  if (!Number.isFinite(basePay) || basePay <= 0 || percent === null || !Number.isFinite(percent) || percent <= 0) {
    return { ...EMPTY_PAYROLL_SUPPLEMENT };
  }
  const additional = basePay * percent / 100;
  const aguinaldoReference = cents(additional * 0.5);
  const vacationsReference = cents(additional * 0.4);
  const vacationPremiumReference = cents(additional * 0.1);
  return {
    aguinaldoReference, vacationsReference, vacationPremiumReference,
    total: cents(aguinaldoReference + vacationsReference + vacationPremiumReference),
  };
}
export function sumPayrollSupplements(parts: PayrollSupplementBreakdown[]): PayrollSupplementBreakdown {
  return {
    aguinaldoReference: cents(parts.reduce((s, p) => s + p.aguinaldoReference, 0)),
    vacationsReference: cents(parts.reduce((s, p) => s + p.vacationsReference, 0)),
    vacationPremiumReference: cents(parts.reduce((s, p) => s + p.vacationPremiumReference, 0)),
    total: cents(parts.reduce((s, p) => s + p.total, 0)),
  };
}
export function effectiveSupplementPercent(
  rates: { percent: number; effectiveFrom: Date; effectiveTo: Date | null }[],
  at: Date,
): number {
  return rates.find((rate) => rate.effectiveFrom <= at && (!rate.effectiveTo || rate.effectiveTo > at))?.percent ?? 0;
}
export function supplementFromSnapshotAdjustments(items: { origin?: string; concept: string; amount: number }[]): PayrollSupplementBreakdown {
  const amount = (concept: string) => cents(items
    .filter((row) => row.origin === "CONTRACTUAL_SUPPLEMENT" && row.concept === concept)
    .reduce((s, row) => s + row.amount, 0));
  const aguinaldoReference = amount("Referencia presupuestal: aguinaldo");
  const vacationsReference = amount("Referencia presupuestal: vacaciones");
  const vacationPremiumReference = amount("Referencia presupuestal: prima vacacional");
  return { aguinaldoReference, vacationsReference, vacationPremiumReference, total: cents(aguinaldoReference + vacationsReference + vacationPremiumReference) };
}
