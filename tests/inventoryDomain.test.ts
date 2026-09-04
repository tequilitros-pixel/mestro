import assert from "node:assert/strict";
import test from "node:test";
import { groupInventoryDeltas, reconcileValues } from "@/lib/pos2/inventory/domain";

test("inventory batch groups duplicate physical items and sorts locks", () => { const result = groupInventoryDeltas([{ inventoryProductId: "b", quantityDelta: "1", unit: "UNIT" as const }, { inventoryProductId: "a", quantityDelta: "2", unit: "UNIT" as const }, { inventoryProductId: "b", quantityDelta: "3", unit: "UNIT" as const }]); assert.deepEqual(result.map((x) => x.inventoryProductId), ["a", "b"]); assert.equal(result[1].delta.toString(), "4"); });
test("inventory rejects zero and fractional UNIT deltas", () => { assert.throws(() => groupInventoryDeltas([{ inventoryProductId: "a", quantityDelta: "0", unit: "UNIT" as const }])); assert.throws(() => groupInventoryDeltas([{ inventoryProductId: "a", quantityDelta: "0.5", unit: "UNIT" as const }])); });
test("reconciliation status is exact Decimal equality", () => { assert.equal(reconcileValues("1.000000", "1"), "MATCH"); assert.equal(reconcileValues("1", "0.999999"), "MISMATCH"); });
