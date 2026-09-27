import assert from "node:assert/strict";
import test from "node:test";
import { getStockShortfall } from "@/lib/inventory/stockSelection";

test("calcula solo lo que falta para alcanzar el mínimo de una sucursal", () => {
  assert.equal(getStockShortfall(10, 50), 40);
  assert.equal(getStockShortfall(50, 50), 0);
  assert.equal(getStockShortfall(65, 50), 0);
});

test("un mínimo desactivado no genera surtido y conserva faltantes negativos", () => {
  assert.equal(getStockShortfall(12, 0), 0);
  assert.equal(getStockShortfall(-2, 10), 12);
  assert.equal(getStockShortfall(8, Number.NaN), 0);
});
