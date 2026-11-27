import test from "node:test";
import assert from "node:assert/strict";
import { calculateWeeklyCountFlow, type WeeklyFlowMovement } from "../lib/inventory/weeklyCountFlow";

const start = new Date("2026-11-19T12:00:00Z");
const end = new Date("2026-11-26T12:00:00Z");
const during = new Date("2026-11-22T12:00:00Z");
const movement = (movementType: string, quantityDelta: number, overrides: Partial<WeeklyFlowMovement> = {}): WeeklyFlowMovement => ({
  inventoryProductId: "tequila", unit: "ML", movementType, quantityDelta, balanceBefore: 0,
  createdAt: during, sourceType: "SALE", sourceId: "other", ...overrides,
});
const base = { productId: "tequila", unit: "ML", countId: "current", initialQuantity: 10000, start, end, expectedQuantity: 11200 };
test("weekly count combines receipts and incoming transfers, nets POS reversals and excludes its own correction", () => {
  const flow = calculateWeeklyCountFlow({ ...base, movements: [
    movement("RECEIPT", 3000), movement("TRANSFER_IN", 1000),
    movement("SALE_CONSUMPTION", -2500), movement("SALE_REVERSAL", 500),
    movement("TRANSFER_OUT", -600), movement("ADJUSTMENT_OUT", -200),
    movement("COUNT_CORRECTION", -100, { sourceType: "COUNT", sourceId: "current" }),
    movement("RECEIPT", 9000, { createdAt: start }),
    movement("RECEIPT", 9000, { createdAt: new Date(end.getTime() + 1) }),
    movement("RECEIPT", 9000, { inventoryProductId: "ice" }),
  ] });
  assert.deepEqual(flow, { initialQuantity: 10000, entriesQuantity: 4000, quantityConsumed: 2000, otherQuantity: -800, reconciles: true });
});
test("known quiet period shows zero, rather than unknown", () => {
  assert.deepEqual(calculateWeeklyCountFlow({ ...base, expectedQuantity: 10000, movements: [] }), {
    initialQuantity: 10000, entriesQuantity: 0, quantityConsumed: 0, otherQuantity: 0, reconciles: true,
  });
});
test("returns of older sales remain negative net consumption", () => {
  assert.equal(calculateWeeklyCountFlow({ ...base, expectedQuantity: 10500, movements: [movement("SALE_REVERSAL", 500)] })?.quantityConsumed, -500);
});
test("no historical baseline is not reported as zero", () => {
  assert.equal(calculateWeeklyCountFlow({ ...base, initialQuantity: null, start: null, movements: [movement("RECEIPT", 1000)] }), null);
});
test("opening balance establishes a first-count baseline without counting it as a receipt", () => {
  assert.deepEqual(calculateWeeklyCountFlow({ ...base, initialQuantity: null, start: null, expectedQuantity: 5500, movements: [
    movement("OPENING_BALANCE", 5000, { createdAt: start }), movement("RECEIPT", 1000), movement("SALE_CONSUMPTION", -500),
  ] }), { initialQuantity: 5000, entriesQuantity: 1000, quantityConsumed: 500, otherQuantity: 0, reconciles: true });
});
test("incompatible units are never combined and ledger discrepancies are flagged", () => {
  assert.equal(calculateWeeklyCountFlow({ ...base, movements: [movement("RECEIPT", 1, { unit: "UNIT" })] }), null);
  assert.equal(calculateWeeklyCountFlow({ ...base, movements: [] })?.reconciles, false);
});
