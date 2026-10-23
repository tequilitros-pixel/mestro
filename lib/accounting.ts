import { Prisma } from "@prisma/client";
import {
  addDaysToDateOnly,
  firstDayOfMonth,
  formatDateOnly,
  lastDayOfMonth,
  mondayOfWeek,
  parseDateOnly,
} from "@/lib/dateOnly";

export const PAYMENT_METHODS = [
  ["EFECTIVO", "Efectivo"],
  ["TRANSFERENCIA", "Transferencia"],
  ["TARJETA", "Tarjeta"],
  ["CHEQUE", "Cheque"],
  ["OTRO", "Otro"],
] as const;

export type AccountingPeriod = "day" | "week" | "month" | "year";

export function validDateOnly(value: string): boolean {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDateOnly(parseDateOnly(value)) === value;
  } catch {
    return false;
  }
}

export function periodRange(period: AccountingPeriod, anchor: string) {
  if (!validDateOnly(anchor)) throw new Error("Fecha inválida");
  if (period === "day") return { from: anchor, to: anchor };
  if (period === "week") {
    const from = mondayOfWeek(anchor);
    return { from, to: addDaysToDateOnly(from, 6) };
  }
  if (period === "month") return { from: firstDayOfMonth(anchor), to: lastDayOfMonth(anchor) };
  return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
}

/** Mueve el ancla al periodo anterior o siguiente sin depender del huso horario. */
export function shiftPeriodAnchor(period: AccountingPeriod, anchor: string, direction: -1 | 1): string {
  if (!validDateOnly(anchor)) throw new Error("Fecha inválida");
  if (period === "day") return addDaysToDateOnly(anchor, direction);
  if (period === "week") return addDaysToDateOnly(mondayOfWeek(anchor), direction * 7);
  if (period === "month") {
    const date = parseDateOnly(firstDayOfMonth(anchor));
    date.setUTCMonth(date.getUTCMonth() + direction);
    return formatDateOnly(date);
  }
  const date = parseDateOnly(`${anchor.slice(0, 4)}-01-01`);
  date.setUTCFullYear(date.getUTCFullYear() + direction);
  return formatDateOnly(date);
}

export function methodLabel(code: string): string {
  return PAYMENT_METHODS.find(([key]) => key === code)?.[1] ?? code;
}

export function parsePaymentAmount(value: string): string | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(normalized)) return null;
  if (Number(normalized) <= 0) return null;
  return normalized;
}

export function formatPaymentMoney(value: Prisma.Decimal.Value): string {
  const fixed = new Prisma.Decimal(value).toFixed(2);
  const [whole, cents] = fixed.split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}
