import test from "node:test";
import assert from "node:assert/strict";
import { isBranchAllowed } from "@/lib/branches/access";
import { isInventoryManagerReadPath } from "@/lib/permission-modules";
import {
  formatCommercialPresentation,
  formatCommercialQuantity,
  hasValidCommercialConversion,
} from "@/lib/inventory/units";
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

test("ML comercial divide la existencia base entre el contenido configurado", () => {
  const botella = {
    inventoryBaseUnit: "ML",
    handlingUnit: "BOTELLA",
    contentPerUnit: 1800,
    contentUnit: "ML",
    normalizedContentPerUnit: 1800,
  };

  assert.equal(formatCommercialQuantity(32400, botella), "18 botellas");
  assert.equal(formatCommercialQuantity(31500, botella), "17.5 botellas");
  assert.equal(formatCommercialQuantity(33300, botella), "18.5 botellas");
  assert.equal(formatCommercialQuantity(-900, botella), "-0.5 botella");
  assert.equal(formatCommercialQuantity(0, botella), "0 botellas");
});

test("UNIT comercial conserva la división configurada para paquetes", () => {
  const vasos = {
    productName: "Vasos desechables",
    inventoryBaseUnit: "UNIT",
    handlingUnit: "PAQUETE",
    contentPerUnit: 25,
    contentUnit: "PIEZAS",
    normalizedContentPerUnit: 25,
  };

  assert.equal(formatCommercialQuantity(50, vasos), "2 paquetes (50 vasos)");
  assert.equal(formatCommercialQuantity(250, vasos), "10 paquetes (250 vasos)");
});

test("una conversión inválida no etiqueta la unidad base como presentación comercial", () => {
  const invalidBottle = {
    unit: "botella",
    inventoryBaseUnit: "ML",
    handlingUnit: "BOTELLA",
    contentPerUnit: 1800,
    contentUnit: "PIEZAS",
    normalizedContentPerUnit: 1800,
  };

  assert.equal(hasValidCommercialConversion(invalidBottle), false);
  assert.equal(formatCommercialQuantity(32400, invalidBottle), "32,400 ml · Presentación por configurar");
});
