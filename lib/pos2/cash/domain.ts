import { Money } from "@/lib/domain/money";

export type CashSessionState = "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED";

const TRANSITIONS: Record<CashSessionState, readonly CashSessionState[]> = {
  OPEN: ["CLOSING", "CANCELLED"],
  CLOSING: ["OPEN", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransitionCashSession(from: CashSessionState, to: CashSessionState) {
  return TRANSITIONS[from].includes(to);
}

export function calculateExpectedCash(movements: Array<{ amount: string; direction: "IN" | "OUT" }>) {
  return movements.reduce(
    (total, movement) => movement.direction === "IN" ? total.add(Money.from(movement.amount)) : total.subtract(Money.from(movement.amount)),
    Money.zero(),
  );
}

export function calculateCashDifference(declared: string, expected: string) {
  return Money.nonNegative(declared).subtract(Money.from(expected));
}
