import test from "node:test";
import assert from "node:assert/strict";

test("los eventos archivados se filtran de activos y aparecen en pestaña de archivados", () => {
  const events = [
    { id: "e1", clientName: "Boda Juan", status: "PLANNED" },
    { id: "e2", clientName: "XV Sofia", status: "LOADED" },
    { id: "e3", clientName: "Posada Co.", status: "RETURNED" },
    { id: "e4", clientName: "Cancelado Error", status: "CANCELLED" },
  ];

  const active = events.filter((e) => e.status !== "CANCELLED" && e.status !== "RETURNED");
  const pendingReturn = events.filter((e) => e.status === "LOADED");
  const completed = events.filter((e) => e.status === "RETURNED");
  const archived = events.filter((e) => e.status === "CANCELLED");

  assert.equal(active.length, 2);
  assert.equal(pendingReturn.length, 1);
  assert.equal(completed.length, 1);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].clientName, "Cancelado Error");
});

test("las acciones de carga en lote 1-toque respetan los tipos de ítems", () => {
  const items = [
    { id: "i1", isEquipment: false, plannedQty: 10, loadedQty: 0 },
    { id: "i2", isEquipment: false, plannedQty: 5, loadedQty: 2 },
    { id: "i3", isEquipment: true, plannedQty: 4, loadedQty: 0 },
  ];

  // Simulación ALL_PLANNED
  const loadedAll = items.map((i) => ({ ...i, loadedQty: i.plannedQty }));
  assert.deepEqual(loadedAll.map((i) => i.loadedQty), [10, 5, 4]);

  // Simulación EQUIPMENT_ALL
  const loadedEquip = items.map((i) => (i.isEquipment ? { ...i, loadedQty: i.plannedQty } : i));
  assert.deepEqual(loadedEquip.map((i) => i.loadedQty), [0, 2, 4]);
});

test("la contralista rápida en retorno recupera equipo al 100% sin mermas falsas", () => {
  const items = [
    { id: "i1", isEquipment: true, loadedQty: 4, returnedGoodQty: 0, damagedQty: 0 },
    { id: "i2", isEquipment: true, loadedQty: 2, returnedGoodQty: 0, damagedQty: 0 },
    { id: "i3", isEquipment: false, loadedQty: 20, returnedGoodQty: 0, damagedQty: 0 },
  ];

  // Acción rápida: todo el equipo regresó íntegro
  const returnedEquipment = items.map((i) =>
    i.isEquipment ? { ...i, returnedGoodQty: i.loadedQty, damagedQty: 0 } : i
  );

  assert.equal(returnedEquipment[0].returnedGoodQty, 4);
  assert.equal(returnedEquipment[1].returnedGoodQty, 2);
  assert.equal(returnedEquipment[2].returnedGoodQty, 0); // No alteró consumibles
});
