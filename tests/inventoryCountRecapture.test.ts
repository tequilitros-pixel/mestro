import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { countProductsNeedingRecapture } from "../lib/inventory/countRecapture";

const at = (time: string) => new Date(time);
test("no cerrar conteos cuando hay ventas posteriores a la captura física", () => {
  const stale = countProductsNeedingRecapture(
    [
      { productId: "tequila", countedAt: at("2026-11-05T00:12:00Z") },
      { productId: "hielo", countedAt: at("2026-11-06T21:40:00Z") },
    ],
    [
      { inventoryProductId: "tequila", createdAt: at("2026-11-05T02:00:00Z"), quantityDelta: new Prisma.Decimal("-120") },
      { inventoryProductId: "hielo", createdAt: at("2026-11-06T20:00:00Z"), quantityDelta: new Prisma.Decimal("-1000") },
    ],
  );
  assert.deepEqual(stale, ["tequila"]);
});

test("una devolución que compensa exactamente la venta no obliga a recuento", () => {
  assert.deepEqual(countProductsNeedingRecapture(
    [{ productId: "tequila", countedAt: at("2026-11-05T00:12:00Z") }],
    [
      { inventoryProductId: "tequila", createdAt: at("2026-11-05T00:13:00Z"), quantityDelta: new Prisma.Decimal("-180") },
      { inventoryProductId: "tequila", createdAt: at("2026-11-05T00:14:00Z"), quantityDelta: new Prisma.Decimal("180") },
    ],
  ), []);
});
