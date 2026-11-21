import test from "node:test";
import assert from "node:assert/strict";
import { isBranchAllowed } from "@/lib/branches/access";
import { canAccessModule, canCaptureInventoryCount, isInventoryCountCaptureRole, isInventoryManagerReadPath } from "@/lib/permission-modules";
import { formatCommercialPresentation, formatCommercialQuantity, formatInventoryDashboardQuantity } from "@/lib/inventory/units";
import { canViewInventoryCountSystemData } from "@/lib/inventory/countVisibility";

test("ADMIN tiene alcance global y el gerente respeta UserBranch", () => {
  assert.equal(isBranchAllowed(null, "otra-sucursal"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "canoas"), true);
  assert.equal(isBranchAllowed(["canoas", "veliz"], "tlaltenango"), false);
});

test("las lecturas permitidas no habilitan formularios nuevos", () => {
  assert.equal(isInventoryManagerReadPath("/administration/inventory/products"), true);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/sucursales/stock"), true);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-counts/known-id"), false);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-counts/new"), false);
  assert.equal(isInventoryManagerReadPath("/administration/inventory/branch-entries"), false);
  assert.equal(isInventoryCountCaptureRole("GERENTE"), true);
  assert.equal(isInventoryCountCaptureRole("ENCARGADO"), true);
  assert.equal(isInventoryCountCaptureRole("OPERATOR"), true);
  assert.equal(isInventoryCountCaptureRole("CONSULTA"), false);
});

test("permiso de conteo delegable para ENCARGADO sin ampliar permisos", () => {
  const key = "/administration/inventory/branch-counts";
  assert.equal(canCaptureInventoryCount("ENCARGADO", [key]), true);
  assert.equal(canCaptureInventoryCount("ENCARGADO", []), false);
  assert.equal(canCaptureInventoryCount("CONSULTA", [key]), false);
  assert.equal(canCaptureInventoryCount("GERENTE", []), true);
  assert.equal(canCaptureInventoryCount("OPERATOR", []), true);
  assert.equal(canAccessModule("ENCARGADO", [key], key), true);
  assert.equal(canAccessModule("ENCARGADO", [], key), false);
  assert.equal(canAccessModule("ENCARGADO", [key], "/administration/inventory/products"), false);
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
  assert.equal(formatCommercialQuantity(-11, vaso), "-11 vasos");
});

test("el dashboard expresa faltantes de hielo en bolsas y kilogramos sin cambiar su base en gramos", () => {
  const hielo = { productName: "Hielo", inventoryBaseUnit: "G", handlingUnit: "BOLSA", contentPerUnit: 5, contentUnit: "KG", normalizedContentPerUnit: 5000 };
  assert.equal(formatInventoryDashboardQuantity(-70_000, hielo), "−14 bolsas (70 kg)");
  assert.equal(formatInventoryDashboardQuantity(2_500, hielo), "0.5 bolsa (2.5 kg)");
});

test("el dashboard convierte gramos y mililitros crudos a kilogramos y litros legibles", () => {
  const sal = { productName: "Sal en grano", inventoryBaseUnit: "G", handlingUnit: null, contentPerUnit: null, contentUnit: null, normalizedContentPerUnit: null };
  assert.equal(formatInventoryDashboardQuantity(10_000, sal), "10 kg");
  assert.equal(formatInventoryDashboardQuantity(-10_000, sal), "−10 kg");
  assert.equal(formatInventoryDashboardQuantity(450, sal), "450 g");

  const tequila = { productName: "Tequila Blanco", inventoryBaseUnit: "ML", handlingUnit: null, contentPerUnit: null, contentUnit: null, normalizedContentPerUnit: null };
  assert.equal(formatInventoryDashboardQuantity(45_000, tequila), "45 L");
  assert.equal(formatInventoryDashboardQuantity(-2_500, tequila), "−2.5 L");
  assert.equal(formatInventoryDashboardQuantity(750, tequila), "750 ml");
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
