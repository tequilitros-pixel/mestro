import assert from "node:assert/strict";
import test from "node:test";
import { calculateCashDifference, calculateExpectedCash, canTransitionCashSession } from "@/lib/pos2/cash/domain";

test("CashSession state machine only allows explicit forward transitions", () => {
  assert.equal(canTransitionCashSession("OPEN", "CLOSING"), true);
  assert.equal(canTransitionCashSession("CLOSING", "CLOSED"), true);
  assert.equal(canTransitionCashSession("CLOSED", "OPEN"), false);
  assert.equal(canTransitionCashSession("CANCELLED", "OPEN"), false);
});

test("expected cash is the signed sum of the immutable ledger", () => {
  const expected = calculateExpectedCash([
    { amount: "100.00", direction: "IN" },
    { amount: "50.25", direction: "IN" },
    { amount: "20.10", direction: "OUT" },
  ]);
  assert.equal(expected.toString(), "130.15");
});

test("difference is declared minus expected", () => {
  assert.equal(calculateCashDifference("105.00", "100.00").toString(), "5.00");
  assert.equal(calculateCashDifference("95.00", "100.00").toString(), "-5.00");
});
