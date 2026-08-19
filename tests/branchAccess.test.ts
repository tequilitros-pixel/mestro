import assert from "node:assert/strict";
import test from "node:test";
import { isBranchAllowed } from "../lib/branches/access";

test("ADMIN con acceso total puede operar cualquier sucursal", () => {
  assert.equal(isBranchAllowed(null, "tlaltenango"), true);
  assert.equal(isBranchAllowed(null, "centro"), true);
});

test("un gerente solo puede operar sus sucursales asignadas", () => {
  const allowed = ["canoas", "centro"];
  assert.equal(isBranchAllowed(allowed, "canoas"), true);
  assert.equal(isBranchAllowed(allowed, "centro"), true);
  assert.equal(isBranchAllowed(allowed, "tlaltenango"), false);
});

test("un usuario sin sucursales no puede registrar movimientos", () => {
  assert.equal(isBranchAllowed([], "tlaltenango"), false);
});
