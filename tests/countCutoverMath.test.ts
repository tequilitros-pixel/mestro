import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { calculateCountCutoverBalance } from "@/lib/inventory/countCutoverMath";

test("el cierre conserva una venta posterior a la captura física", () => {
  const result = calculateCountCutoverBalance({
    currentBalance: new Prisma.Decimal(8),
    countedQuantity: new Prisma.Decimal(10),
    postCaptureDelta: new Prisma.Decimal(-2),
  });

  assert.equal(result.balanceAfter.toString(), "8");
  assert.equal(result.correctionDelta.toString(), "0");
});

test("el cierre aplica la diferencia física y conserva movimientos posteriores", () => {
  const result = calculateCountCutoverBalance({
    currentBalance: new Prisma.Decimal(8),
    countedQuantity: new Prisma.Decimal(8),
    postCaptureDelta: new Prisma.Decimal(-2),
  });

  assert.equal(result.balanceAfter.toString(), "6");
  assert.equal(result.correctionDelta.toString(), "-2");
});

test("el cierre conserva una recepción posterior a la captura física", () => {
  const result = calculateCountCutoverBalance({
    currentBalance: new Prisma.Decimal(13),
    countedQuantity: new Prisma.Decimal(10),
    postCaptureDelta: new Prisma.Decimal(3),
  });

  assert.equal(result.balanceAfter.toString(), "13");
  assert.equal(result.correctionDelta.toString(), "0");
});
