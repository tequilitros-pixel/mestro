import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStock,
  resolveStockBranchSelection,
} from "@/lib/inventory/stockSelection";
import { buildInventoryCountItemClientView } from "@/lib/inventory/countPresentation";
import {
  getInventoryCaptureDescriptor,
  getInventoryCaptureInputValue,
  formatCommercialPresentation,
  formatCommercialQuantity,
} from "@/lib/inventory/units";
import { normalizeInventoryCountCapture } from "@/lib/inventory/countCapture";

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

test("la captura comercial de botella normaliza una sola vez y se puede reabrir", () => {
  const botella = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "ML",
    handlingUnit: "BOTELLA",
    contentPerUnit: 1800,
    contentUnit: "ML",
    normalizedContentPerUnit: 1800,
  };

  assert.deepEqual(getInventoryCaptureDescriptor(32400, botella), {
    captureUnit: "PRESENTATION",
    quantity: 18,
    unitLabel: "botellas",
  });
  assert.equal(getInventoryCaptureInputValue(31500, botella), "17.5");

  const firstSave = normalizeInventoryCountCapture({
    quantity: "17.5",
    captureUnit: "PRESENTATION",
    product: botella,
  });
  assert.equal(firstSave.capturedQuantity.toString(), "17.5");
  assert.equal(firstSave.baseQuantity.toString(), "31500");
  assert.equal(getInventoryCaptureInputValue(firstSave.baseQuantity.toString(), botella), "17.5");

  const saveWithoutEdit = normalizeInventoryCountCapture({
    quantity: getInventoryCaptureInputValue(firstSave.baseQuantity.toString(), botella),
    captureUnit: "PRESENTATION",
    product: botella,
  });
  assert.equal(saveWithoutEdit.baseQuantity.toString(), "31500");

  const changed = normalizeInventoryCountCapture({
    quantity: "18",
    captureUnit: "PRESENTATION",
    product: botella,
  });
  assert.equal(changed.baseQuantity.toString(), "32400");

  const zero = normalizeInventoryCountCapture({
    quantity: "0",
    captureUnit: "PRESENTATION",
    product: botella,
  });
  assert.equal(zero.baseQuantity.toString(), "0");

  assert.throws(
    () => normalizeInventoryCountCapture({ quantity: "", captureUnit: "PRESENTATION", product: botella }),
    /COUNT_QUANTITY_REQUIRED/,
  );
  assert.throws(
    () => normalizeInventoryCountCapture({ quantity: "-1", captureUnit: "PRESENTATION", product: botella }),
    /COUNT_QUANTITY_INVALID/,
  );
});

test("la captura de paquetes usa la conversión configurada", () => {
  const vasos = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "UNIT",
    handlingUnit: "PAQUETE",
    contentPerUnit: 25,
    contentUnit: "PIEZAS",
    normalizedContentPerUnit: 25,
  };

  const normalized = normalizeInventoryCountCapture({
    quantity: "2",
    captureUnit: "PRESENTATION",
    product: vasos,
  });
  assert.equal(normalized.baseQuantity.toString(), "50");
  assert.equal(getInventoryCaptureInputValue("50", vasos), "2");
});

test("la captura base explícita conserva un borrador existente", () => {
  const botella = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "ML",
    handlingUnit: "BOTELLA",
    contentPerUnit: 1800,
    contentUnit: "ML",
    normalizedContentPerUnit: 1800,
  };

  const base = normalizeInventoryCountCapture({
    quantity: "31500",
    captureUnit: "BASE",
    product: botella,
  });
  assert.equal(base.baseQuantity.toString(), "31500");
  assert.equal(getInventoryCaptureInputValue(base.baseQuantity.toString(), botella), "17.5");
});

test("una presentación inválida no acepta captura comercial", () => {
  const invalid = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "ML",
    handlingUnit: "BOTELLA",
    contentPerUnit: 1800,
    contentUnit: "PIEZAS",
    normalizedContentPerUnit: 1800,
  };

  assert.throws(
    () => normalizeInventoryCountCapture({ quantity: "17.5", captureUnit: "PRESENTATION", product: invalid }),
    /PRESENTATION_NOT_CONFIGURED/,
  );
});
