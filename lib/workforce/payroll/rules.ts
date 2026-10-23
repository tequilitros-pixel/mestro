import { Prisma, type WorkforceRateType } from "@prisma/client";

const D = Prisma.Decimal;
export const MONEY_ROUNDING = "ROUND_HALF_UP_COMPONENTS";
const cents = (value: Prisma.Decimal) => value.toDecimalPlaces(2, D.ROUND_HALF_UP);

export type PayrollDailyInput = {
  businessDate: Date;
  payRateId: string;
  rateType: WorkforceRateType;
  rate: Prisma.Decimal.Value;
  currency: string;
  ordinaryMinutes: number;
  doubleMinutes: number;
  tripleMinutes: number;
};

export function calculatePayrollMoney(
  days: PayrollDailyInput[],
  adjustments: Array<{ direction: "EARNING" | "DEDUCTION"; amount: Prisma.Decimal.Value }> = [],
) {
  if (!days.length) throw new Error("PAYROLL_NO_PAYABLE_DAYS");
  const currencies = new Set(days.map((day) => day.currency));
  if (currencies.size !== 1) throw new Error("PAYROLL_CURRENCY_MISMATCH");
  if ([...currencies][0]?.length !== 3) throw new Error("PAYROLL_CURRENCY_INVALID");
  const segments = days.map((day) => {
    if (day.rateType !== "HOURLY") throw new Error("PAYROLL_UNSUPPORTED_RATE_TYPE");
    if ([day.ordinaryMinutes, day.doubleMinutes, day.tripleMinutes].some((value) => !Number.isInteger(value) || value < 0))
      throw new Error("PAYROLL_INVALID_MINUTES");
    const hourlyRate = new D(day.rate);
    if (!hourlyRate.isPositive()) throw new Error("PAYROLL_INVALID_RATE");
    const component = (minutes: number, multiplier: number) =>
      cents(hourlyRate.mul(minutes).mul(multiplier).div(60));
    return {
      ...day,
      hourlyRate,
      ordinaryPay: component(day.ordinaryMinutes, 1),
      doublePay: component(day.doubleMinutes, 2),
      triplePay: component(day.tripleMinutes, 3),
    };
  });
  const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.add(value), new D(0));
  const ordinaryPay = sum(segments.map((item) => item.ordinaryPay));
  const doublePay = sum(segments.map((item) => item.doublePay));
  const triplePay = sum(segments.map((item) => item.triplePay));
  const earningsAmount = sum(adjustments.filter((item) => item.direction === "EARNING").map((item) => cents(new D(item.amount))));
  const deductionsAmount = sum(adjustments.filter((item) => item.direction === "DEDUCTION").map((item) => cents(new D(item.amount))));
  if (adjustments.some((item) => !new D(item.amount).isPositive())) throw new Error("PAYROLL_INVALID_ADJUSTMENT");
  const baseEarnings = ordinaryPay.add(doublePay).add(triplePay);
  const grossAmount = baseEarnings.add(earningsAmount);
  const operationalPayable = grossAmount.sub(deductionsAmount);
  if (operationalPayable.isNegative()) throw new Error("PAYROLL_NEGATIVE_PAYABLE");
  return {
    currency: [...currencies][0], segments,
    ordinaryMinutes: segments.reduce((n, item) => n + item.ordinaryMinutes, 0),
    doubleMinutes: segments.reduce((n, item) => n + item.doubleMinutes, 0),
    tripleMinutes: segments.reduce((n, item) => n + item.tripleMinutes, 0),
    ordinaryPay, doublePay, triplePay, baseEarnings,
    earningsAmount, deductionsAmount, grossAmount, operationalPayable,
  };
}

export function payrollReadiness(blockers: string[]) {
  return blockers.length ? "BLOCKED" as const : "READY" as const;
}

export function effectivePayRateBlocker(rates: Array<{
  rateType: WorkforceRateType; currency: string | null;
}>) {
  if (!rates.length) return "PAY_RATE_MISSING";
  if (rates.length > 1) return "PAY_RATE_OVERLAP";
  if (rates[0].rateType !== "HOURLY") return "PAY_RATE_UNSUPPORTED";
  if (!rates[0].currency) return "PAY_RATE_CURRENCY_MISSING";
  return null;
}

export function assertPayrollAdmin(actor: { role: string } | null | undefined) {
  if (actor?.role !== "ADMIN") throw new Error("No autorizado.");
  return actor;
}

export function canReadPayrollStatement(ownerUserId: string | null, actorUserId: string) {
  return ownerUserId === actorUserId;
}
