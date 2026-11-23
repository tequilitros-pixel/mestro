import assert from "node:assert/strict";
import test from "node:test";
import { offlineQueueDecision } from "../lib/offline/syncPolicy";

test("una operación POS cancelada nunca se reenvía automáticamente", () => {
  assert.equal(offlineQueueDecision("cancelled"), "skip");
});
test("un cobro fallido requiere reintento manual y bloquea posteriores", () => {
  assert.equal(offlineQueueDecision("failed"), "stop");
});
test("una operación sin confirmación al cerrar la pestaña no se reenvía a ciegas", () => {
  assert.equal(offlineQueueDecision("syncing"), "stop");
});
test("solo una operación nueva puede reclamar turno de envío", () => {
  assert.equal(offlineQueueDecision("pending"), "claim");
});
