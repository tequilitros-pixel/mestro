export type HourlyRateRow = {
  branchId: string | null;
  amount: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

/** Historical branch override, then the profile rate that applied to the week. */
export function resolveBranchHourlyRate(
  rates: HourlyRateRow[],
  branchId: string,
  workedAt: Date,
  generalRate: number | null,
): number | null {
  const branchRate = rates.find(
    (rate) => rate.branchId === branchId
      && rate.effectiveFrom <= workedAt
      && (rate.effectiveTo === null || rate.effectiveTo > workedAt),
  );
  return branchRate?.amount ?? generalRate;
}

export function summarizeHourlyRates(
  rates: Array<number | null>,
  defaultRate: number | null,
): { hourlyRate: number | null; missingRate: boolean; variableRate: boolean } {
  if (rates.length === 0) {
    return { hourlyRate: defaultRate, missingRate: defaultRate === null, variableRate: false };
  }
  const present = [...new Set(rates.filter((rate): rate is number => rate !== null))];
  return {
    hourlyRate: present.length === 1 ? present[0] : null,
    missingRate: rates.includes(null),
    variableRate: present.length > 1,
  };
}
