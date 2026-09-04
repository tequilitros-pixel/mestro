import assert from "node:assert/strict";
import test from "node:test";
import { Money } from "../lib/domain/money";

test("Money suma 0.1 + 0.2 sin error binario", () => {
  assert.equal(Money.from("0.1").add(Money.from("0.2")).toString(), "0.30");
});

test("Money usa ROUND_HALF_UP a centavos", () => {
  assert.equal(Money.from("1.005").toString(), "1.01");
  assert.equal(Money.from("1.004").toString(), "1.00");
});

test("Money soporta suma, resta, multiplicación y cantidades grandes", () => {
  const value = Money.from("999999999999.99").add(Money.from("0.01"));
  assert.equal(value.toString(), "1000000000000.00");
  assert.equal(value.subtract(Money.from("1")).multiply("2").toString(), "1999999999998.00");
});

test("Money compara y serializa de forma estable", () => {
  const money = Money.from("42");
  assert.equal(money.equals(Money.from("42.00")), true);
  assert.equal(money.compare(Money.from("41.99")), 1);
  assert.deepEqual(money.toJSON(), { amount: "42.00", currency: "MXN" });
  assert.equal(Money.from(money.toDecimal()).toString(), "42.00");
});

test("Money permite negativos contables pero los identifica explícitamente", () => {
  assert.equal(Money.from("-0.01").isNegative(), true);
  assert.throws(() => Money.from("NaN"));
  assert.throws(() => Money.nonNegative("-0.01"), /cannot be negative/);
});
