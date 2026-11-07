import assert from "node:assert/strict";
import test from "node:test";
import {
  canClaimForSync,
  describeSyncFailure,
  getUnconfirmedSaleIds,
  needsPosSaleReconciliation,
  shouldAutomaticallySyncOperation,
} from "../lib/offline/syncPolicy";

test("cancelled operations never leave the offline queue for server replay", () => {
  assert.equal(shouldAutomaticallySyncOperation({ id: "sale-1", kind: "pos.sale.create", status: "cancelled" }), false);
  assert.equal(shouldAutomaticallySyncOperation({ id: "email-1", kind: "pos.sale.email", status: "cancelled" }), false);
});

test("failed POS sales wait for manual retry while other legacy failed operations keep their policy", () => {
  assert.equal(shouldAutomaticallySyncOperation({ id: "sale-1", kind: "pos.sale.create", status: "failed" }), false);
  assert.equal(shouldAutomaticallySyncOperation({ id: "sale-2", kind: "pos.sale.create", status: "pending" }), true);
  assert.equal(shouldAutomaticallySyncOperation({ id: "sale-3", kind: "pos.sale.create", status: "syncing" }), true);
  assert.equal(shouldAutomaticallySyncOperation({ id: "boiler-1", kind: "boiler.event.create", status: "failed" }), true);
});

test("simultaneous tabs cannot claim a fresh in-flight sale; interrupted claims recover", () => {
  const now = Date.parse("2026-11-01T20:00:00.000Z");
  assert.equal(canClaimForSync({ id: "sale", kind: "pos.sale.create", status: "pending" }, now), true);
  assert.equal(canClaimForSync({ id: "sale", kind: "pos.sale.create", status: "cancelled" }, now), false);
  assert.equal(canClaimForSync({ id: "sale", kind: "pos.sale.create", status: "failed" }, now), false);
  assert.equal(
    canClaimForSync({ id: "sale", kind: "pos.sale.create", status: "syncing", syncStartedAt: "2026-11-01T19:59:30.000Z" }, now),
    false,
  );
  assert.equal(
    canClaimForSync({ id: "sale", kind: "pos.sale.create", status: "syncing", syncStartedAt: "2026-11-01T19:57:00.000Z" }, now),
    true,
  );
  assert.equal(canClaimForSync({ id: "legacy-sale", kind: "pos.sale.create", status: "syncing" }, now), true);
});

test("receipt email is blocked until a failed or cancelled local sale is reconciled", () => {
  const blocked = getUnconfirmedSaleIds([
    { id: "failed-sale", kind: "pos.sale.create", status: "failed" },
    { id: "cancelled-sale", kind: "pos.sale.create", status: "cancelled" },
    { id: "pending-sale", kind: "pos.sale.create", status: "pending" },
    { id: "unrelated", kind: "cash-cut.open", status: "failed" },
  ]);
  assert.deepEqual([...blocked].sort(), ["cancelled-sale", "failed-sale"]);
});

test("server validation and domain errors remain readable to the cashier", () => {
  assert.equal(
    describeSyncFailure({ error: "No hay un corte de caja abierto." }, 400),
    "No hay un corte de caja abierto.",
  );
  assert.equal(
    describeSyncFailure({ error: { code: "INSUFFICIENT_STOCK", message: "Inventario insuficiente." } }, 409),
    "Inventario insuficiente. (código: INSUFFICIENT_STOCK)",
  );
  assert.equal(
    describeSyncFailure({ error: { code: "IDEMPOTENCY_KEY_REUSED" } }, 409),
    "Error de sincronización: IDEMPOTENCY_KEY_REUSED (HTTP 409).",
  );
  assert.equal(describeSyncFailure({ message: "La venta no se pudo completar." }, 422), "La venta no se pudo completar.");
  assert.equal(describeSyncFailure(null, 503), "Error de sincronización (HTTP 503).");
  assert.equal(describeSyncFailure({ error: {} }, 401), "La sesión no está autorizada para sincronizar (HTTP 401).");
});

test("identity and closed cash cut conflicts cannot be retried without reconciliation", () => {
  assert.equal(needsPosSaleReconciliation("POS_IDENTITY_REVIEW_REQUIRED: conflicto"), true);
  assert.equal(needsPosSaleReconciliation("El cobro falló (código: IDEMPOTENCY_KEY_REUSED)"), true);
  assert.equal(needsPosSaleReconciliation("CASH_SESSION_NOT_OPEN: cierre previo"), true);
  assert.equal(needsPosSaleReconciliation("Inventario insuficiente."), false);
  assert.equal(needsPosSaleReconciliation(), false);
});
