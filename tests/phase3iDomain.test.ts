import assert from "node:assert/strict";
import test from "node:test";
import { allocateCents, evaluateAutomaticPromotions, evaluateRule, historicalRefundAmount, isRuleActive, type EngineRule } from "../lib/pos2/adjustments/engine";

const at = new Date("2026-08-31T18:00:00.000Z");
const base: EngineRule = { id: "r1", definitionId: "d1", code: "RULE", name: "Rule", kind: "PROMOTION", mechanic: "PERCENT_OFF", scope: "GLOBAL", branchId: null, targetType: "ENTIRE_ORDER", targetId: null, percentage: "50", amount: null, bundleQuantity: null, priority: 1, stacking: "EXCLUSIVE", excludedProductIds: [], excludedCategoryIds: [], requiresBeneficiary: false, requiresAuthorization: false, maxAmount: null, validFrom: new Date("2026-01-01T00:00:00Z"), validTo: null, weekdays: [], startMinute: null, endMinute: null, timezone: "America/Mexico_City" };
const line = (id: string, gross: string, quantity = "1") => ({ id, productId: `p-${id}`, variantId: null, categoryId: "cat", quantity, gross });

test("50% of $99 is represented as Decimal money", () => assert.equal(evaluateRule(base, [line("a", "99.00")])?.amount, "49.50"));
test("bundle 4x100 allocates only complete bundles", () => { const result = evaluateRule({ ...base, mechanic: "FIXED_BUNDLE_PRICE", percentage: null, amount: "100", bundleQuantity: "4" }, [line("a", "150.00", "5")]); assert.equal(result?.amount, "20.00"); });
test("exclusions are honored", () => assert.equal(evaluateRule({ ...base, excludedProductIds: ["p-a"] }, [line("a", "99.00")]), null));
test("largest remainder allocation is deterministic and cent exact", () => assert.deepEqual(allocateCents("0.01", [{ key: "b", amount: "1" }, { key: "a", amount: "1" }]), [{ lineId: "a", amount: "0.01" }, { lineId: "b", amount: "0.00" }]));
test("branch and local schedule gates are deterministic", () => { const rule = { ...base, scope: "BRANCH" as const, branchId: "b1", weekdays: [1], startMinute: 11 * 60, endMinute: 13 * 60 }; assert.equal(isRuleActive(rule, "b1", at), true); assert.equal(isRuleActive(rule, "b2", at), false); });
test("exclusive tie resolves by priority, benefit, id", () => { const rules = [{ ...base, id: "z", priority: 1, percentage: "10" }, { ...base, id: "a", priority: 2, percentage: "5" }]; assert.equal(evaluateAutomaticPromotions({ branchId: "b1", at, lines: [line("x", "100")], rules })[0]?.ruleId, "a"); });
test("courtesy keeps kind and reason-ready result", () => assert.equal(evaluateRule({ ...base, kind: "COURTESY", mechanic: "FIXED_AMOUNT_OFF", percentage: null, amount: "10" }, [line("a", "15")])?.kind, "COURTESY"));
test("partial returns use historical net line value", () => assert.equal(historicalRefundAmount("100.00", "4", "1"), "25.00"));
