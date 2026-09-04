import assert from "node:assert/strict";
import test from "node:test";
import { calculateLineTotal, calculateOrderTotals, canTransitionOrder, parseOrderQuantity } from "@/lib/pos2/orders/domain";

test("Order state machine exposes only approved transitions", () => {
  assert.equal(canTransitionOrder("OPEN", "PAYMENT_PENDING"), true);
  assert.equal(canTransitionOrder("PAYMENT_PENDING", "OPEN"), true);
  assert.equal(canTransitionOrder("PAYMENT_PENDING", "FINALIZED"), true);
  assert.equal(canTransitionOrder("FINALIZED", "OPEN"), false);
  assert.equal(canTransitionOrder("VOIDED", "PAYMENT_PENDING"), false);
});
test("UNIT quantities are positive integers while ML accepts decimals", () => {
  assert.equal(parseOrderQuantity("2", "UNIT").toString(), "2.000000");
  assert.equal(parseOrderQuantity("125.5", "ML").toString(), "125.500000");
  assert.throws(() => parseOrderQuantity("1.5", "UNIT")); assert.throws(() => parseOrderQuantity("0", "ML"));
});
test("line and order totals use Money exact arithmetic", () => {
  assert.equal(calculateLineTotal("33.33", "3").toString(), "99.99");
  const totals = calculateOrderTotals([{ lineTotal: "99.99" }, { lineTotal: "0.01" }]);
  assert.equal(totals.subtotal.toString(), "100.00"); assert.equal(totals.discountTotal.toString(), "0.00"); assert.equal(totals.total.toString(), "100.00");
});
