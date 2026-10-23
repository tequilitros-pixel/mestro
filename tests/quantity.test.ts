import assert from "node:assert/strict";
import test from "node:test";
import { Quantity } from "../lib/domain/quantity";

test("Quantity opera UNIT con precisión Decimal", () => {
  assert.equal(Quantity.from("0.1", "UNIT").add(Quantity.from("0.2", "UNIT")).toString(), "0.300000");
});

test("Quantity opera ML y conserva unidad", () => {
  const quantity = Quantity.from("750.125", "ML").subtract(Quantity.from("250.125", "ML"));
  assert.deepEqual(quantity.toJSON(), { value: "500.000000", unit: "ML" });
});

test("Quantity rechaza operaciones entre unidades incompatibles", () => {
  assert.throws(() => Quantity.from("500", "ML").add(Quantity.from("2", "UNIT")), /Incompatible/);
});

test("Quantity compara, multiplica y hace round-trip Decimal", () => {
  const quantity = Quantity.from("1.1234567", "ML");
  assert.equal(quantity.toString(), "1.123457");
  assert.equal(quantity.multiply("2").compare(Quantity.from("2", "ML")), 1);
  assert.equal(Quantity.from(quantity.toDecimal(), "ML").equals(quantity), true);
  assert.throws(() => Quantity.nonNegative("-1", "UNIT"), /cannot be negative/);
});
