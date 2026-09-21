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
  getMainModuleDestination,
  getCurrentModule,
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

test("Punto de Venta separa vender y transacciones dentro de POSpress", () => {
  const main = MAIN_MODULES.find((module) => module.module === "pos");
  const sale = SUBMENUS.pos.find((item) => item.label === "POSpress");
  const transactions = SUBMENUS.pos.find((item) => item.label === "Transacciones");

  assert.equal(main?.href, "/pospress");
  assert.equal(sale?.permissionKey, "/pos");
  assert.equal(transactions?.permissionKey, "/pos/sales");
  assert.equal(getSubmenuItemDestination("GERENTE", ["/pos"], sale!), "/pospress");
  assert.equal(getMainModuleDestination("GERENTE", ["/pos"], main!), "/pospress");
  assert.equal(
    getMainModuleDestination("GERENTE", ["/pos/sales"], main!),
    "/pospress/transactions",
  );
  assert.equal(getCurrentModule("/pos2"), "pos");
  assert.equal(getCurrentModule("/pospress/transactions"), "pos");
});

test("cada permiso configurable tiene una pestaña y se resuelve exactamente", () => {
  for (const key of configurableKeys) {
    assert.ok(
      allLeaves.some((item) => item.href === key || item.permissionKey === key),
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

test("Vender no concede la pestaña de Transacciones", () => {
  const items = SUBMENUS.pos;
  const visible = (label: string) =>
    isSubmenuItemVisible("GERENTE", ["/pos"], items.find((item) => item.label === label)!);

  assert.equal(visible("POSpress"), true);
  assert.equal(visible("Mesas"), true);
  assert.equal(visible("Transacciones"), false);
});

test("un permiso terciario abre directamente el hijo autorizado", () => {
  const parent = SUBMENUS.administration.find(
    (item) => item.label === "Sucursales",
  )!;
  const keys = ["/administration/inventory/sucursales/stock"];

  assert.equal(isSubmenuItemVisible("ENCARGADO", keys, parent), true);
  assert.equal(getSubmenuItemDestination("ENCARGADO", keys, parent), keys[0]);
  assert.equal(
    isSubmenuItemVisible("ENCARGADO", keys, parent.children![0]),
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

test("Control de Cortes abre su dashboard", () => {
  const control = SUBMENUS["cash-cuts"].find((item) => item.label === "Control")!;

  assert.equal(getSubmenuItemDestination("ADMIN", [], control), "/cash-cuts/dashboard");
  assert.equal(control.children!.some((item) => item.href.startsWith("/pos/")), false);
});

test("Caldera pertenece al módulo de Producción", () => {
  assert.equal(getCurrentModule("/boiler"), "production");
  assert.equal(getModuleKeyForPath("/boiler/sessions/active"), "/boiler");
});

test("permisos obsoletos no desactivan la compatibilidad del operador", () => {
  const boiler = SUBMENUS.production.find((item) => item.href === "/boiler")!;
  assert.equal(isSubmenuItemVisible("OPERATOR", ["/permiso-antiguo"], boiler), true);
});

test("Gerente ve las superficies de inventario de solo lectura", () => {
  const products = SUBMENUS.administration.find(
    (item) => item.href === "/administration/inventory/products",
  )!;
  const events = SUBMENUS.administration.find((item) => item.label === "Eventos")!;
  assert.equal(isSubmenuItemVisible("GERENTE", [], products), true);
  assert.equal(isSubmenuItemVisible("GERENTE", [], events), false);
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
