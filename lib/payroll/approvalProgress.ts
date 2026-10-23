type ApprovalRow = {
  finalPay: number;
  approval: { status: "BORRADOR" | "REVISION" | "APROBADA" | "PAGADA" };
};

/** Particiona centavos aprobados y pendientes sin confundir aprobación con pago. */
export function payrollApprovalProgress(rows: readonly ApprovalRow[]) {
  let approvedCents = 0;
  let remainingCents = 0;
  for (const row of rows) {
    const cents = Math.round(row.finalPay * 100);
    if (row.approval.status === "APROBADA" || row.approval.status === "PAGADA") {
      approvedCents += cents;
    } else {
      remainingCents += cents;
    }
  }
  return { approved: approvedCents / 100, remaining: remainingCents / 100 };
}
