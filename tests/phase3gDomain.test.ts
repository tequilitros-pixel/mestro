import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "@/lib/domain/errors";
import { validatePayments } from "@/lib/pos2/sales/paymentDomain";

test("Phase 3G validates exact, mixed and cash tender payments", () => {
  const result = validatePayments([{ method: "CASH", amount: "40", cashTendered: "50" }, { method: "CARD", amount: "60", reference: "AUTH" }], "100");
  assert.equal(result[0].change?.toString(), "10.00"); assert.equal(result[1].change, null);
});
test("Phase 3G rejects payment mismatch and non-cash tender fields", () => {
  assert.throws(() => validatePayments([{ method: "CASH", amount: "99" }], "100"), (error: unknown) => error instanceof DomainError && error.code === "PAYMENT_MISMATCH");
  assert.throws(() => validatePayments([{ method: "CARD", amount: "100", cashTendered: "100" }], "100"), (error: unknown) => error instanceof DomainError && error.code === "VALIDATION_ERROR");
});
