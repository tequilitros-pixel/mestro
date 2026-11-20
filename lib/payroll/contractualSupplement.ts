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
  // Redondear una sola vez el adicional total; distribuir sus centavos
  // entre referencias sin generar una deducción compensatoria.
  const totalCents = Math.round((basePay * percent / 100 + Number.EPSILON) * 100);
  const aguinaldoCents = Math.round(totalCents * 0.5);
  const vacacionesCents = Math.round(totalCents * 0.4);
  const primaCents = totalCents - aguinaldoCents - vacacionesCents;
  return {
    aguinaldoReference: aguinaldoCents / 100,
    vacationsReference: vacacionesCents / 100,
    vacationPremiumReference: primaCents / 100,
    total: totalCents / 100,
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

/** No permitir descuentos por redondeo/ajustes de centavos en nómina. */
export function isPayrollRoundingDeduction(concept: string): boolean {
  const plain = concept.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:ajuste\s+(?:de\s+)?centavos|ajuste\s+(?:por\s+)?redondeo|diferencia\s+de\s+redondeo)\b/.test(plain)
    || (plain.includes("complementos de nomina") && /centavos|redondeo/.test(plain));
}

export type PayrollReceiptAdjustment = {
  origin?: string;
  type: "BONO" | "DEDUCCION";
  amount: number;
};
/** Calcula importes visibles del recibo en centavos, sin compensaciones inventadas. */
export function reconcilePayrollReceipt(
  basePay: number, overtimePay: number, supplementTotal: number,
  adjustments: PayrollReceiptAdjustment[], approvedTotal: number,
) {
  const toCents = (value: number) => Math.round(value * 100);
  const recorded = adjustments.filter((item) => item.origin !== "CONTRACTUAL_SUPPLEMENT");
  const bonusCents = recorded.filter((item) => item.type === "BONO").reduce((sum, row) => sum + toCents(row.amount), 0);
  const deductionCents = recorded.filter((item) => item.type === "DEDUCCION").reduce((sum, row) => sum + toCents(row.amount), 0);
  const totalCents = toCents(basePay) + toCents(overtimePay) + toCents(supplementTotal) + bonusCents - deductionCents;
  return {
    bonuses: bonusCents / 100,
    deductions: deductionCents / 100,
    computedTotal: totalCents / 100,
    // Rechazar discrepancias materiales: no fabricar "ajuste de centavos".
    matchesApproved: Math.abs(totalCents - toCents(approvedTotal)) <= 1,
  };
}
