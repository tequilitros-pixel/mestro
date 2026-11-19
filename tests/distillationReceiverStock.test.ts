import test from "node:test";
import assert from "node:assert/strict";
import { receiverTotals } from "../lib/distillation/receiverMath";

test("un tanque de 2000 L con 1650 L permite dos rectificaciones de 825 L", () => {
  const transfers = Array.from({ length: 11 }, () => ({ liters: 150, alcohol: 27 }));
  const stock = receiverTotals({
    transfers,
    rectifications: [
      { loadedLiters: 825, status: "ACTIVA" },
      { loadedLiters: 825, status: "ACTIVA" },
    ],
  });
  assert.equal(stock.receivedLiters, 1650);
  assert.equal(stock.allocatedLiters, 1650);
  assert.equal(stock.availableLiters, 0);
  assert.equal(stock.initialAlcohol, 27);
});

test("dos cargas de 800 L dejan 50 L en el receptor", () => {
  const stock = receiverTotals({
    transfers: [{ liters: 1650, alcohol: 26 }],
    rectifications: [
      { loadedLiters: 800, status: "ACTIVA" },
      { loadedLiters: 800, status: "ACTIVA" },
    ],
  });
  assert.equal(stock.availableLiters, 50);
});

test("cancelar una carga devuelve el saldo solo dentro de su ciclo receptor", () => {
  const stock = receiverTotals({
    transfers: [{ liters: 1650, alcohol: 30 }],
    rectifications: [
      { loadedLiters: 825, status: "ACTIVA" },
      { loadedLiters: 825, status: "CANCELADA" },
    ],
  });
  assert.equal(stock.availableLiters, 825);
});

test("alcohol inicial es el promedio volumétrico y no se inventa si falta medición", () => {
  const measured = receiverTotals({
    transfers: [{ liters: 600, alcohol: 24 }, { liters: 400, alcohol: 29 }],
    rectifications: [],
  });
  assert.equal(measured.initialAlcohol, 26);
  const missing = receiverTotals({
    transfers: [{ liters: 600, alcohol: 24 }, { liters: 400, alcohol: null }],
    rectifications: [],
  });
  assert.equal(missing.initialAlcohol, null);
});
