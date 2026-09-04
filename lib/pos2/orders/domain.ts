import { Money } from "@/lib/domain/money";
import { Quantity, type QuantityUnit } from "@/lib/domain/quantity";

export type OrderStatus = "OPEN" | "PAYMENT_PENDING" | "FINALIZED" | "VOIDED" | "EXPIRED";

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  OPEN: ["PAYMENT_PENDING", "VOIDED", "EXPIRED"],
  PAYMENT_PENDING: ["OPEN", "FINALIZED", "VOIDED"],
  FINALIZED: [], VOIDED: [], EXPIRED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) { return TRANSITIONS[from].includes(to); }

export function parseOrderQuantity(value: string, unit: QuantityUnit) {
  const quantity = Quantity.from(value, unit);
  if (quantity.compare(Quantity.zero(unit)) <= 0) throw new Error("Quantity must be positive");
  if (unit === "UNIT" && !quantity.toDecimal().isInteger()) throw new Error("UNIT quantity must be an integer");
  return quantity;
}

export function calculateLineTotal(unitPrice: string, quantity: string) {
  return Money.from(unitPrice).multiply(quantity);
}

export function calculateOrderTotals(lines: Array<{ lineTotal: string }>) {
  const subtotal = lines.reduce((sum, line) => sum.add(Money.from(line.lineTotal)), Money.zero());
  const discountTotal = Money.zero();
  return { subtotal, discountTotal, total: subtotal.subtract(discountTotal) };
}
