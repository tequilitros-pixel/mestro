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

import { buildInventoryCountItemClientView } from "@/lib/inventory/countPresentation";
import type { InventoryHandlingUnit, InventoryContentUnit } from "@prisma/client";

test("buildInventoryCountItemClientView conserva notas, merma y categoría del producto", () => {
  const itemRecord = {
    id: "item-1",
    notes: "Botella rota en recepción",
    quantityCounted: "10.000",
    countedAt: new Date("2026-10-22T10:00:00Z"),
    previousQuantity: "12.000",
    entriesQuantity: "0",
    quantityConsumed: "2",
    costTotal: "150.00",
    product: {
      id: "prod-1",
      code: "TEQ-01",
      category: "Licores",
      name: "Tequila Blanco 750ml",
      unit: "botella",
      inventoryBaseUnit: "ML",
      handlingUnit: "BOTELLA" as InventoryHandlingUnit,
      contentPerUnit: 750,
      contentUnit: "ML" as InventoryContentUnit,
      normalizedContentPerUnit: 750,
    },
  };

  const clientView = buildInventoryCountItemClientView(itemRecord, {
    status: "BORRADOR",
    canViewHistory: true,
  });

  assert.equal(clientView.id, "item-1");
  assert.equal(clientView.productName, "Tequila Blanco 750ml");
  assert.equal(clientView.productCategory, "Licores");
  assert.equal(clientView.notes, "Botella rota en recepción");
  assert.equal(clientView.isCaptured, true);
  assert.equal(clientView.quantityCounted, 10);
  assert.equal(clientView.previousQuantity, 12);
});

test("buildInventoryCountItemClientView oculta historial para roles de conteo ciego", () => {
  const itemRecord = {
    id: "item-2",
    notes: null,
    quantityCounted: null,
    countedAt: null,
    previousQuantity: "15.000",
    entriesQuantity: "5",
    quantityConsumed: null,
    costTotal: null,
    product: {
      name: "Hielo 5kg",
      unit: "bolsa",
      inventoryBaseUnit: "UNIT",
      handlingUnit: "UNIDAD" as InventoryHandlingUnit,
      contentPerUnit: 1,
      contentUnit: "PIEZAS" as InventoryContentUnit,
      normalizedContentPerUnit: 1,
    },
  };

  const clientView = buildInventoryCountItemClientView(itemRecord, {
    status: "BORRADOR",
    canViewHistory: false,
  });

  assert.equal(clientView.isCaptured, false);
  assert.equal(clientView.previousQuantity, undefined);
});
