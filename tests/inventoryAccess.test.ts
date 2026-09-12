import test from "node:test";
import assert from "node:assert/strict";
import { isBranchAllowed } from "@/lib/branches/access";
import { isInventoryManagerReadPath } from "@/lib/permission-modules";
import { formatCommercialQuantity } from "@/lib/inventory/units";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";

test("ADMIN tiene alcance global y el gerente respeta UserBranch", () => {
  assert.equal(isBranchAllowed(null, "otra-sucursal"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "canoas"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "tlaltenango"), false);
});

test("el scope de conteos conserva multi-sucursal y limita una sola sucursal", () => {
  const branches = [
    { id: "barra", name: "Barra" },
    { id: "canoas", name: "Canoas" },
    { id: "huejucar", name: "Huejúcar" },
    { id: "veliz", name: "Veliz" },
  ];

  const visible = (allowed: string[] | null) =>
    branches.filter((branch) => allowed === null || allowed.includes(branch.id));

  assert.deepEqual(visible(["canoas", "veliz"]).map((branch) => branch.id), [
    "canoas",
    "veliz",
  ]);
  assert.deepEqual(visible(["huejucar"]).map((branch) => branch.id), ["huejucar"]);
  assert.deepEqual(visible(null).map((branch) => branch.id), [
    "barra",
    "canoas",
    "huejucar",
    "veliz",
  ]);
});

test("las lecturas permitidas no habilitan formularios nuevos", () => {
  assert.equal(isInventoryManagerReadPath("/administration/inventory/products"), true);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/sucursales/stock"), true);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-counts/known-id"), true);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-counts/new"), false);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-entries"), false);
});

test("el conteo ciego oculta expected/system al gerente", () => {
  assert.equal(canViewInventoryCountSystemData("GERENTE"), false);
  assert.equal(canViewInventoryCountSystemData("ADMIN"), true);
});

test("UNIT multipack se presenta como piezas y conserva su contenido", () => {
  const vaso = { inventoryBaseUnit: "UNIT", handlingUnit: "PAQUETE", contentPerUnit: 25, contentUnit: "PIEZAS", normalizedContentPerUnit: 25 };
  assert.equal(formatCommercialQuantity(24, vaso), "24 piezas (25 piezas/paquete)");
  assert.equal(formatCommercialQuantity(25, vaso), "1 paquete (25 piezas; 25 piezas/paquete)");
});
