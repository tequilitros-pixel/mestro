import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStock,
  resolveStockBranchSelection,
} from "@/lib/inventory/stockSelection";
import { buildInventoryCountItemClientView } from "@/lib/inventory/countPresentation";
import {
  formatCommercialPresentation,
  formatCommercialQuantity,
} from "@/lib/inventory/units";

const branches = [
  { id: "canoas", name: "Canoas" },
  { id: "veliz", name: "Veliz" },
  { id: "barra", name: "Barra" },
];

test("stock por ubicación selecciona únicamente Canoas, Veliz o Barra", () => {
  for (const branch of branches) {
    const selection = resolveStockBranchSelection(branches, branch.id);
    assert.equal(selection.rejected, false);
    assert.equal(selection.branch?.id, branch.id);
  }

  const unauthorized = resolveStockBranchSelection([branches[0]], "veliz");
  assert.equal(unauthorized.rejected, true);
  assert.equal(unauthorized.branch, null);
});

test("stock negativo conserva el signo y tiene prioridad como alerta", () => {
  assert.equal(classifyStock(-3, 20), "NEGATIVE");
  assert.equal(classifyStock(2, 20), "LOW");
  assert.equal(classifyStock(20, 20), "OK");
});

const countItem = {
  id: "item-1",
  quantityCounted: "12.500",
  previousQuantity: "17.500",
  entriesQuantity: "4",
  quantityConsumed: "9",
  costTotal: "90.00",
  product: {
    name: "Vaso grande",
    unit: "Pza",
    inventoryBaseUnit: "UNIT",
    handlingUnit: "PAQUETE",
    contentPerUnit: "25",
    contentUnit: "PIEZAS",
    normalizedContentPerUnit: "25",
  },
};

test("el payload de un conteo abierto omite todo dato teórico e histórico", () => {
  const open = buildInventoryCountItemClientView(countItem, {
    status: "BORRADOR",
    canViewHistory: true,
  });

  assert.equal("previousQuantity" in open, false);
  assert.equal("entriesQuantity" in open, false);
  assert.equal("quantityConsumed" in open, false);
  assert.equal("costTotal" in open, false);
});

test("el historial cerrado conserva contraste y unidad comercial", () => {
  const closed = buildInventoryCountItemClientView(countItem, {
    status: "CERRADO",
    canViewHistory: true,
  });

  assert.equal(closed.previousQuantity, 17.5);
  assert.equal(closed.entriesQuantity, 4);
  assert.equal(closed.quantityConsumed, 9);
  assert.equal(closed.costTotal, 90);
  assert.equal(formatCommercialPresentation(closed), "Paquete de 25 vasos");
  assert.equal(formatCommercialQuantity(50, closed), "2 paquetes (50 vasos)");
});
