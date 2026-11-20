/** La firma sólo cierra la semana cuando todos los expedientes están PAGADOS. */
export function shouldClosePayrollPeriodOnReceipt(
  periodStatus: string,
  totalEntries: number,
  outstandingEntries: number,
): boolean {
  return periodStatus !== "PAGADA"
    && periodStatus !== "BORRADOR"
    && totalEntries > 0
    && outstandingEntries === 0;
}
