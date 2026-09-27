import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInventoryCountCapture } from "@/lib/inventory/countCapture";

const vasoGrande = {
  productName: "Vaso grande",
  inventoryBaseUnit: "UNIT",
  handlingUnit: "PAQUETE",
  contentPerUnit: 25,
  contentUnit: "PIEZAS",
  normalizedContentPerUnit: 25,
  isActive: true,
  trackStock: true,
};

test("un conteo de vasos suma paquetes completos y piezas sueltas", () => {
  const result = normalizeInventoryCountCapture({
    quantity: "17",
    loosePieces: "5",
    captureUnit: "PRESENTATION",
    product: vasoGrande,
  });

  assert.equal(result.baseQuantity.toString(), "430");
});

test("un conteo de vasos no permite registrar piezas sueltas equivalentes a otro paquete", () => {
  assert.throws(
    () => normalizeInventoryCountCapture({
      quantity: "17",
      loosePieces: "25",
      captureUnit: "PRESENTATION",
      product: vasoGrande,
    }),
    { message: "COUNT_LOOSE_PIECES_LIMIT" },
  );
});

test("un conteo de vasos requiere paquetes y piezas sueltas enteros", () => {
  assert.throws(
    () => normalizeInventoryCountCapture({
      quantity: "17.5",
      loosePieces: "5",
      captureUnit: "PRESENTATION",
      product: vasoGrande,
    }),
    { message: "COUNT_PACKAGES_WHOLE" },
  );
  assert.throws(
    () => normalizeInventoryCountCapture({
      quantity: "17",
      loosePieces: "5.5",
      captureUnit: "PRESENTATION",
      product: vasoGrande,
    }),
    { message: "COUNT_LOOSE_PIECES_WHOLE" },
  );
});
