import assert from "node:assert/strict";
import test from "node:test";
import {
  PERMISSION_GROUPS,
  getModuleKeyForPath,
  isAdminOnlyPath,
  isAlwaysAvailablePath,
} from "../lib/permission-modules";
import {
  MAIN_MODULES,
  SUBMENUS,
  getSubmenuItemDestination,
  isMainModuleVisible,
  isSubmenuItemVisible,
  type SubMenuItem,
} from "../components/layout/navigation";

const configurableKeys = PERMISSION_GROUPS.flatMap((group) =>
  group.modules.map((module) => module.key),
);

function leaves(items: SubMenuItem[]): SubMenuItem[] {
  return items.flatMap((item) => item.children ? leaves(item.children) : [item]);
}

const allLeaves = Object.values(SUBMENUS).flatMap(leaves);

test("cada permiso configurable tiene una pestaña y se resuelve exactamente", () => {
  for (const key of configurableKeys) {
    assert.ok(
      allLeaves.some((item) => item.href === key),
      `Falta una pestaña de navegación para ${key}`,
    );
    assert.equal(getModuleKeyForPath(key), key, `Resolución incorrecta para ${key}`);
  }
});

test("cada pestaña delegable está representada en el catálogo de permisos", () => {
  for (const item of allLeaves) {
    if (
      item.href === "/" ||
      item.href === "/administration" ||
      isAlwaysAvailablePath(item.href) ||
      isAdminOnlyPath(item.href)
    ) continue;

    const requiredKey = item.permissionKey ?? getModuleKeyForPath(item.href);
    assert.ok(requiredKey, `La pestaña ${item.href} no tiene protección asignada`);
    assert.ok(
      configurableKeys.includes(requiredKey),
      `La pestaña ${item.href} usa un permiso que no aparece en configuración: ${requiredKey}`,
    );
  }
});

test("Vender no concede Ventas ni los reportes de Descuentos", () => {
  const items = SUBMENUS.pos;
  const visible = (label: string) =>
    isSubmenuItemVisible("GERENTE", ["/pos"], items.find((item) => item.label === label)!);

  assert.equal(visible("Vender"), true);
  assert.equal(visible("Ventas"), false);
  assert.equal(visible("Descuentos"), false);
});

test("cada reporte terciario de Descuentos requiere su propio permiso", () => {
  const parent = SUBMENUS.pos.find((item) => item.label === "Descuentos")!;
  const keys = ["/pos/discounts/employees"];

  assert.equal(isSubmenuItemVisible("GERENTE", keys, parent), true);
  assert.equal(getSubmenuItemDestination("GERENTE", keys, parent), keys[0]);
  assert.deepEqual(
    parent.children!
      .filter((item) => isSubmenuItemVisible("GERENTE", keys, item))
      .map((item) => item.href),
    keys,
  );
});

test("un permiso terciario abre directamente el hijo autorizado", () => {
  const parent = SUBMENUS.administration.find(
    (item) => item.label === "Inventario de sucursales",
  )!;
  const keys = ["/administration/inventory/sucursales/stock"];

  assert.equal(isSubmenuItemVisible("GERENTE", keys, parent), true);
  assert.equal(getSubmenuItemDestination("GERENTE", keys, parent), keys[0]);
  assert.equal(
    isSubmenuItemVisible("GERENTE", keys, parent.children![0]),
    false,
    "Stock no debe conceder también el Resumen",
  );
});

test("Cortes activa su módulo principal sin conceder las demás pantallas", () => {
  const keys = ["/cash-cuts/daily"];
  const main = MAIN_MODULES.find((module) => module.module === "cash-cuts")!;
  const visible = SUBMENUS["cash-cuts"]
    .filter((item) => isSubmenuItemVisible("GERENTE", keys, item))
    .map((item) => item.label);

  assert.equal(isMainModuleVisible("GERENTE", keys, main), true);
  assert.deepEqual(visible, ["Cortes"]);
});

test("Control de Cortes abre su dashboard y no mezcla pestañas de Descuentos", () => {
  const control = SUBMENUS["cash-cuts"].find((item) => item.label === "Control")!;
  const discounts = SUBMENUS.pos.find((item) => item.label === "Descuentos")!;

  assert.equal(getSubmenuItemDestination("ADMIN", [], control), "/cash-cuts/dashboard");
  assert.equal(control.children!.some((item) => item.href.startsWith("/pos/")), false);
  assert.equal(discounts.children!.some((item) => item.href === "/pos/discounts/rules"), true);
});

test("Materia prima cuenta con permiso independiente", () => {
  assert.equal(getModuleKeyForPath("/liquors/raw-materials"), "/liquors/raw-materials");
  assert.equal(
    isSubmenuItemVisible(
      "GERENTE",
      ["/liquors/raw-materials"],
      SUBMENUS.liquors.find((item) => item.href === "/liquors/raw-materials")!,
    ),
    true,
  );
});
