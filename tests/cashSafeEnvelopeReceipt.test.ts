import assert from "node:assert/strict";
import test from "node:test";
import { buildAutomaticEnvelopeReceipt } from "../lib/cash-cuts/envelopeReceipt";

test("el sobre queda recibido en caja fuerte con el monto capturado", () => {
  const receivedAt = new Date("2026-09-21T05:00:00.000Z");
  const receipt = buildAutomaticEnvelopeReceipt({
    amount: 1_500,
    userId: "user-1",
    cashCutId: "cut-1",
    receivedAt,
  });

  assert.deepEqual(receipt.envelope, {
    status: "EN_CAJA_FUERTE",
    receivedAmount: 1_500,
    receivedById: "user-1",
    receivedAt,
  });
  assert.deepEqual(receipt.movement, {
    type: "RECEPCION",
    amount: 1_500,
    previousBalance: 1_500,
    newBalance: 1_500,
    cashCutId: "cut-1",
    userId: "user-1",
    notes: "Recepción automática al cerrar el corte",
    createdAt: receivedAt,
  });
});

test("rechaza montos inválidos para no crear sobres vacíos o negativos", () => {
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => buildAutomaticEnvelopeReceipt({ amount, userId: "user-1", cashCutId: "cut-1" }),
      /mayor que cero/,
    );
  }
});
