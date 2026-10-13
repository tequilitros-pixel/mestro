type SnapshotEntry = {
  branchId?: unknown;
  pay?: unknown;
};

type SnapshotDay = {
  entries?: unknown;
};

export type PayrollAllocationEntry = {
  totalPay: unknown;
  basePay: unknown;
  overtimePay: unknown;
  daysSnapshot: unknown;
};

function numberValue(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

function snapshotEntries(value: unknown): SnapshotEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SnapshotEntry => Boolean(entry) && typeof entry === "object");
}

/** Distribuye el snapshot pagado de nómina a una sucursal sin crear movimientos. */
export function allocatePayrollEntries(entries: readonly PayrollAllocationEntry[], branchId: string) {
  let amount = 0;
  let unallocated = 0;
  let entriesWithBranchPay = 0;

  for (const entry of entries) {
    const totalPay = numberValue(entry.totalPay);
    const basePay = numberValue(entry.basePay) + numberValue(entry.overtimePay);
    let branchBase = 0;
    let hasAnyBranchPay = false;

    for (const day of Array.isArray(entry.daysSnapshot) ? entry.daysSnapshot as SnapshotDay[] : []) {
      for (const item of snapshotEntries(day?.entries)) {
        const pay = numberValue(item.pay);
        if (item.branchId && pay > 0) hasAnyBranchPay = true;
        if (item.branchId === branchId) branchBase += pay;
      }
    }

    if (branchBase <= 0) {
      if (!hasAnyBranchPay) unallocated += totalPay;
      continue;
    }

    entriesWithBranchPay += 1;
    const adjustment = totalPay - basePay;
    const allocation = branchBase + (basePay > 0 ? adjustment * (branchBase / basePay) : 0);
    amount += Math.max(0, allocation);
  }

  return { amount, unallocated, entriesWithBranchPay };
}
