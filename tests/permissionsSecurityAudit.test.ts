import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessModule,
  getDefaultPathForModuleKeys,
  getModuleKeyForPath,
  isConfigurablePermissionKey,
} from "../lib/permission-modules";
import { isPublicPath } from "../lib/publicPaths";

test("operador sin matriz conserva solo el proceso histórico completo", () => {
  for (const key of [
    "/cooking",
    "/boiler",
    "/milling",
    "/fermentation",
    "/distillation",
  ]) {
    assert.equal(canAccessModule("OPERATOR", [], key), true, key);
    assert.equal(canAccessModule("OPERATOR", ["/permiso-obsoleto"], key), true, key);
  }
  assert.equal(canAccessModule("OPERATOR", [], "/lots"), false);
});

test("una matriz configurada reemplaza el acceso histórico del operador", () => {
  assert.equal(canAccessModule("OPERATOR", ["/boiler"], "/boiler"), true);
  assert.equal(canAccessModule("OPERATOR", ["/boiler"], "/cooking"), false);
});

test("POSpress conserva permisos separados para venta y transacciones", () => {
  assert.equal(isConfigurablePermissionKey("/pos"), true);
  assert.equal(isConfigurablePermissionKey("/pos/sales"), true);
  assert.equal(isConfigurablePermissionKey("/pos/discounts/rules"), false);
  assert.equal(getDefaultPathForModuleKeys(["/pos"]), "/pospress");
  assert.equal(
    getDefaultPathForModuleKeys(["/pos/sales"]),
    "/pospress/transactions",
  );
});

test("Apple puede abrir soporte y documentos legales sin sesión", () => {
  assert.equal(isPublicPath("/support"), true);
  assert.equal(isPublicPath("/privacy-policy"), true);
  assert.equal(isPublicPath("/terms-of-service"), true);
  assert.equal(isPublicPath("/cooking"), false);
  assert.equal(isPublicPath("/administration"), false);
});

test("rutas anidadas de licores conservan el permiso del flujo", () => {
  assert.equal(
    getModuleKeyForPath("/liquors/products/zarzamora/new"),
    "/liquors/production",
  );
  assert.equal(
    getModuleKeyForPath("/liquors/batches/lote-1/bottling"),
    "/liquors/bottling",
  );
  assert.equal(
    getModuleKeyForPath("/liquors/batches/lote-1/labels/emb-1/preview"),
    "/liquors/bottling",
  );
  assert.equal(getModuleKeyForPath("/liquors/bottles/bot-1/qr"), "/liquors/qr");
  assert.equal(
    getModuleKeyForPath("/liquors/bottles/bot-1"),
    "/liquors/inventory",
  );
});
