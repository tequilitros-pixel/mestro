import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStock,
  resolveStockBranchSelection,
} from "@/lib/inventory/stockSelection";
import {
  buildInventoryCountItemClientView,
  getInventoryCountInputValue,
} from "@/lib/inventory/countPresentation";
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
  countedAt: null,
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
  assert.equal(open.isCaptured, false);
  assert.equal(getInventoryCountInputValue(open), "");
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

test("el cero explícito se distingue de un renglón todavía vacío", () => {
  const pending = buildInventoryCountItemClientView(
    { ...countItem, quantityCounted: "0", countedAt: null },
    { status: "BORRADOR", canViewHistory: true },
  );
  assert.equal(pending.isCaptured, false);
  assert.equal(getInventoryCountInputValue(pending), "");

  const explicitZero = buildInventoryCountItemClientView(
    { ...countItem, quantityCounted: "0", countedAt: new Date("2026-09-12T18:00:00.000Z") },
    { status: "BORRADOR", canViewHistory: true },
  );
  assert.equal(explicitZero.isCaptured, true);
  assert.equal(getInventoryCountInputValue(explicitZero), "0");
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

test("las presentaciones físicas convierten hielo, jugo y agua sin alterar el factor", () => {
  const hielo = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "G",
    handlingUnit: "BOLSA",
    contentPerUnit: 5,
    contentUnit: "KG",
    normalizedContentPerUnit: 5000,
  };
  const jugo = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "ML",
    handlingUnit: "PIEZA",
    contentPerUnit: 3750,
    contentUnit: "ML",
    normalizedContentPerUnit: 3750,
  };
  const agua = {
    isActive: true,
    trackStock: true,
    inventoryBaseUnit: "ML",
    handlingUnit: "PIEZA",
    contentPerUnit: 1000,
    contentUnit: "ML",
    normalizedContentPerUnit: 1000,
  };

  assert.equal(formatCommercialPresentation(hielo), "Bolsa de 5 kg");
  assert.equal(
    normalizeInventoryCountCapture({ quantity: "3", captureUnit: "PRESENTATION", product: hielo }).baseQuantity.toString(),
    "15000",
  );
  assert.equal(formatCommercialQuantity(15000, hielo), "3 bolsas");
  assert.equal(getInventoryCaptureInputValue("15000", hielo), "3");

  assert.equal(
    normalizeInventoryCountCapture({ quantity: "2", captureUnit: "PRESENTATION", product: jugo }).baseQuantity.toString(),
    "7500",
  );
  assert.equal(formatCommercialQuantity(7500, jugo), "2 piezas");
  assert.equal(getInventoryCaptureInputValue("7500", jugo), "2");

  assert.equal(
    normalizeInventoryCountCapture({ quantity: "6", captureUnit: "PRESENTATION", product: agua }).baseQuantity.toString(),
    "6000",
  );
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
