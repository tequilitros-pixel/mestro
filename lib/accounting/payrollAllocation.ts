type SnapshotEntry = {
  branchId?: unknown;
  pay?: unknown;
  clockIn?: unknown;
  clockOut?: unknown;
};

type SnapshotDay = {
  date?: unknown;
  entries?: unknown;
};

export type PayrollAllocationEntry = {
  totalPay: unknown;
  basePay: unknown;
  overtimePay: unknown;
  daysSnapshot: unknown;
};

export type PayrollDayAllocation = {
  date: string;
  shiftCount: number;
  amount: number;
};

function numberValue(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}

function snapshotEntries(value: unknown): SnapshotEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SnapshotEntry => Boolean(entry) && typeof entry === "object");
}

function workedMinutes(entry: SnapshotEntry) {
  if (typeof entry.clockIn !== "string" || typeof entry.clockOut !== "string") return 0;
  const start = Date.parse(entry.clockIn);
  const end = Date.parse(entry.clockOut);
  const minutes = (end - start) / 60_000;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/** Distribuye el snapshot pagado de nómina a una sucursal sin crear movimientos. */
export function allocatePayrollEntry(entry: PayrollAllocationEntry, branchId: string) {
    const totalPay = numberValue(entry.totalPay);
    const basePay = numberValue(entry.basePay) + numberValue(entry.overtimePay);
    let branchBase = 0;
    let hasAnyBranchPay = false;
    let branchMinutes = 0;
    let totalMinutes = 0;
    let hasAnyBranchTime = false;
    const days: PayrollDayAllocation[] = [];
    const minutesByDay = new Map<string, { minutes: number; shiftCount: number }>();

    for (const day of Array.isArray(entry.daysSnapshot) ? entry.daysSnapshot as SnapshotDay[] : []) {
      let dayAmount = 0;
      let shiftCount = 0;
      for (const item of snapshotEntries(day?.entries)) {
        const pay = numberValue(item.pay);
        if (item.branchId && pay > 0) hasAnyBranchPay = true;

        const minutes = workedMinutes(item);
        if (item.branchId && minutes > 0) {
          hasAnyBranchTime = true;
          totalMinutes += minutes;
          if (item.branchId === branchId) {
            branchMinutes += minutes;
            const date = typeof day.date === "string" ? day.date : "";
            if (date) {
              const total = minutesByDay.get(date) ?? { minutes: 0, shiftCount: 0 };
              total.minutes += minutes;
              total.shiftCount += 1;
              minutesByDay.set(date, total);
            }
          }
        }

        if (item.branchId !== branchId) continue;
        branchBase += pay;
        dayAmount += pay;
        shiftCount += 1;
      }
      if (shiftCount > 0) days.push({ date: typeof day.date === "string" ? day.date : "", shiftCount, amount: dayAmount });
    }

    if (branchBase <= 0) {
      if (!hasAnyBranchPay && branchMinutes > 0 && totalMinutes > 0) {
        const amount = totalPay * (branchMinutes / totalMinutes);
        return {
          amount,
          unallocated: 0,
          hasBranchPay: true,
          estimated: true,
          days: [...minutesByDay].map(([date, value]) => ({
            date,
            shiftCount: value.shiftCount,
            amount: amount * (value.minutes / branchMinutes),
          })),
        };
      }
      return { amount: 0, unallocated: hasAnyBranchPay || hasAnyBranchTime ? 0 : totalPay, hasBranchPay: false, estimated: false, days: [] as PayrollDayAllocation[] };
    }

    const adjustment = totalPay - basePay;
    const allocation = Math.max(0, branchBase + (basePay > 0 ? adjustment * (branchBase / basePay) : 0));
    const ratio = branchBase > 0 ? allocation / branchBase : 0;
    return { amount: allocation, unallocated: 0, hasBranchPay: true, estimated: false, days: days.map((day) => ({ ...day, amount: day.amount * ratio })) };
}

export function allocatePayrollEntries(entries: readonly PayrollAllocationEntry[], branchId: string) {
  let amount = 0;
  let unallocated = 0;
  let entriesWithBranchPay = 0;
  let estimatedEntries = 0;

  for (const entry of entries) {
    const allocation = allocatePayrollEntry(entry, branchId);
    amount += allocation.amount;
    unallocated += allocation.unallocated;
    if (allocation.hasBranchPay) entriesWithBranchPay += 1;
    if (allocation.estimated && allocation.amount > 0) estimatedEntries += 1;
  }

  return { amount, unallocated, entriesWithBranchPay, estimatedEntries };
}
