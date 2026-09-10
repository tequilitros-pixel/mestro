import assert from "node:assert/strict";
import test from "node:test";
import { CatalogBaseUnit } from "@prisma/client";
import { cashierIssue } from "../lib/pos2/ui/errors";

test("gramos permanecen representados como G en Prisma", () => {
  assert.equal(CatalogBaseUnit.G, "G");
});

test("error interno de cobro conserva una acción de reintento segura", () => {
  assert.deepEqual(cashierIssue("INTERNAL_ERROR"), {
    title: "Cobro no confirmado",
    message: "El servidor no confirmó el cobro. Conservamos la operación para reintentarla sin duplicar.",
    action: "RETRY_SAME_OPERATION",
  });
});
