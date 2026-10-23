import test from "node:test";
import assert from "node:assert/strict";
import { isBranchAllowed } from "@/lib/branches/access";
import { isInventoryCountCaptureRole, isInventoryManagerReadPath } from "@/lib/permission-modules";
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
  assert.equal(isInventoryCountCaptureRole("OPERATOR"), true);
  assert.equal(isInventoryCountCaptureRole("CONSULTA"), false);
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
