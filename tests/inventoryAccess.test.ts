import test from "node:test";
import assert from "node:assert/strict";
import { isBranchAllowed } from "@/lib/branches/access";
import { isInventoryManagerReadPath } from "@/lib/permission-modules";
import { formatCommercialPresentation, formatCommercialQuantity } from "@/lib/inventory/units";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";

test("ADMIN tiene alcance global y el gerente respeta UserBranch", () => {
  assert.equal(isBranchAllowed(null, "otra-sucursal"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "canoas"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "tlaltenango"), false);
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
  const vaso = { productName: "Vaso grande", inventoryBaseUnit: "UNIT", handlingUnit: "PAQUETE", contentPerUnit: 25, contentUnit: "PIEZAS", normalizedContentPerUnit: 25 };
  assert.equal(formatCommercialPresentation(vaso), "Paquete de 25 vasos");
  assert.equal(formatCommercialQuantity(50, vaso), "2 paquetes (50 vasos)");
  assert.equal(formatCommercialQuantity(47, vaso), "47 vasos (1 paquete + 22 vasos)");
  assert.equal(formatCommercialQuantity(1, { ...vaso, productName: "Vaso mediano" }), "1 vaso (0 paquetes + 1 vaso)");
  assert.equal(formatCommercialQuantity(1, { ...vaso, productName: undefined }), "1 pieza (0 paquetes + 1 pieza)");
});
