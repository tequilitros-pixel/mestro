import assert from "node:assert/strict";
import test from "node:test";
import { buildEventConsumption, reconcileEventReturn, type EventConsumptionItem } from "../lib/inventory/eventAnalytics";

const water: EventConsumptionItem = {
  productId: "water",
  name: "Agua mineral",
  category: "Refrescos",
  unit: "botellas",
  itemType: "CONSUMABLE",
  sent: 12,
  returned: 2,
  damaged: 0,
  returnedOpenBase: 0,
  contentPerUnit: 600,
  contentUnit: "ML",
  unitCost: 10,
};

test("suma una carga posterior del mismo producto sin duplicar el renglón", () => {
  const rows = buildEventConsumption([
    water,
    { ...water, sent: 8, returned: 1, unitCost: 12 },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    key: "water:botellas:600:ML",
    productId: "water",
    name: "Agua mineral",
    category: "Refrescos",
    unit: "botellas",
    sent: 20,
    returned: 3,
    damaged: 0,
    consumed: 17,
    consumedLiters: 10.2,
    consumedCost: 184,
    costKnown: true,
  });
});

test("descuenta remanente abierto y daño de la estimación de consumo", () => {
  const [row] = buildEventConsumption([
    { ...water, sent: 4, returned: 1, damaged: 1, returnedOpenBase: 300 },
  ]);
  assert.equal(row.consumed, 1.5);
  assert.equal(row.consumedLiters, 0.9);
  assert.equal(row.consumedCost, 15);
});

test("excluye equipo de los rankings de consumo", () => {
  assert.deepEqual(buildEventConsumption([{ ...water, itemType: "EQUIPMENT" }]), []);
});

test("separa presentaciones distintas y marca costos desconocidos", () => {
  const rows = buildEventConsumption([
    water,
    { ...water, unit: "latas", contentPerUnit: 355, unitCost: null },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.unit === "latas")?.consumedLiters, 3.55);
  assert.equal(rows.find((row) => row.unit === "latas")?.costKnown, false);
});

test("convierte las piezas de un evento según su presentación histórica", () => {
  const [liquor] = buildEventConsumption([{ ...water, unit: "Pieza", contentPerUnit: 1,
    contentUnit: "L", sent: 2, returned: 1, returnedOpenBase: 640 }]);
  assert.equal(liquor.consumedLiters, 0.36);
  const [cups] = buildEventConsumption([{ ...water, unit: "Pieza", contentPerUnit: 25,
    contentUnit: "PIEZAS", sent: 6, returned: 3, returnedOpenBase: 4 }]);
  assert.equal(cups.consumed, 2.84);
});

test("compara inventario físico contra lo que debería regresar por ventas", () => {
  assert.deepEqual(reconcileEventReturn(10, 4, 5), { expected: 6, difference: -1 });
  assert.deepEqual(reconcileEventReturn(10, 4, 7), { expected: 6, difference: 1 });
  assert.deepEqual(reconcileEventReturn(10, 4, 6), { expected: 6, difference: 0 });
});
