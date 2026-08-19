import assert from "node:assert/strict";
import test from "node:test";
import {
  denominationTotal,
  remainingCashFund,
  validDenominationRows,
} from "../lib/cash-cuts/denominations";

test("calcula el total de un conteo por denominaciones", () => {
  assert.equal(denominationTotal([
    { value: 500, quantity: 5 },
    { value: 20, quantity: 2 },
    { value: 1, quantity: 3 },
    { value: 0.5, quantity: 1 },
  ]), 2543.5);
});

test("descuenta el sobre del total contado y deja el resto como fondo", () => {
  assert.equal(remainingCashFund(4853.5, 3000), 1853.5);
});

test("rechaza denominaciones inventadas, fracciones y cantidades negativas", () => {
  assert.deepEqual(validDenominationRows([
    { value: 500, quantity: 5 },
    { value: 3, quantity: 1 },
    { value: 20, quantity: 1.5 },
    { value: 10, quantity: -1 },
  ]), [{ value: 500, quantity: 5 }]);
});
