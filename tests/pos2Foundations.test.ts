import assert from "node:assert/strict";
import test from "node:test";
import { generateOperationId, isUuidV7 } from "../lib/pos2/operationId";
import { canonicalPayload, hashPayload } from "../lib/pos2/payloadHash";
import { evaluateCapability, type GrantView, type ShadowActor } from "../lib/pos2/capabilityPolicy";
import { sanitizeAuditMetadata } from "../lib/pos2/auditMetadata";

test("genera operationId UUIDv7 válido", () => {
  const id = generateOperationId(1_700_000_000_000);
  assert.equal(isUuidV7(id), true);
  assert.equal(id.startsWith("018bcfe5-6800-7"), true);
});

test("canonical payload y hash no dependen del orden de claves", () => {
  assert.equal(canonicalPayload({ b: 2, a: 1 }), canonicalPayload({ a: 1, b: 2 }));
  assert.equal(hashPayload({ b: [2, 1], a: true }), hashPayload({ a: true, b: [2, 1] }));
  assert.notEqual(hashPayload({ a: 1 }), hashPayload({ a: 2 }));
});

test("shadow capability respeta GLOBAL, BRANCH y usuario/rol", () => {
  const actor: ShadowActor = { id: "u1", role: "GERENTE", branchIds: ["b1", "b2"] };
  const grants: GrantView[] = [
    { capabilityKey: "inventory.adjust", userId: null, role: "GERENTE", scope: "BRANCH", branchId: "b1" },
    { capabilityKey: "catalog.edit", userId: "u1", role: null, scope: "GLOBAL", branchId: null },
  ];
  assert.equal(evaluateCapability(actor, "inventory.adjust", "b1", grants), true);
  assert.equal(evaluateCapability(actor, "inventory.adjust", "b2", grants), false);
  assert.equal(evaluateCapability(actor, "catalog.edit", undefined, grants), true);
  assert.equal(evaluateCapability({ ...actor, id: "u2" }, "catalog.edit", undefined, grants), false);
});

test("audit metadata elimina secretos y conserva escalares seguros", () => {
  assert.deepEqual(sanitizeAuditMetadata({ saleId: "s1", total: 10, pin: "1234", authToken: "secret", nested: { nope: true }, empty: null }), {
    saleId: "s1", total: 10, empty: null,
  });
});
