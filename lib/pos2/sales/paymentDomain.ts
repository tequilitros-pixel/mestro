import { Money } from "@/lib/domain/money";
import { DomainError } from "@/lib/domain/errors";

export type PaymentInput = { method: "CASH" | "CARD" | "TRANSFER"; amount: string; cashTendered?: string; reference?: string };

export function validatePayments(inputs: PaymentInput[], orderTotal: string) {
  if (!inputs.length) throw new DomainError("PAYMENT_MISMATCH", { reason: "empty" });
  let total = Money.zero();
  const payments = inputs.map((input, position) => {
    if (!(["CASH", "CARD", "TRANSFER"] as string[]).includes(input.method)) throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.method` });
    let amount: Money;
    try { amount = Money.nonNegative(input.amount); } catch { throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.amount` }); }
    if (amount.equals(Money.zero())) throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.amount` });
    total = total.add(amount);
    if (input.method === "CASH") {
      let tendered: Money;
      try { tendered = Money.nonNegative(input.cashTendered ?? input.amount); } catch { throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.cashTendered` }); }
      if (tendered.compare(amount) < 0) throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.cashTendered` });
      return { ...input, amount, tendered, change: tendered.subtract(amount), position };
    }
    if (input.cashTendered !== undefined) throw new DomainError("VALIDATION_ERROR", { field: `payments.${position}.cashTendered` });
    return { ...input, amount, tendered: null, change: null, position };
  });
  const expected = Money.from(orderTotal);
  if (!total.equals(expected)) throw new DomainError("PAYMENT_MISMATCH", { expected: expected.toString(), received: total.toString() });
  return payments;
}
