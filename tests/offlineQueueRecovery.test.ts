import assert from "node:assert/strict";
import test from "node:test";
import { syncOfflineQueue } from "../lib/offline/sync";
import { cancelQueuedOperation, retryQueuedOperation } from "../lib/offline/queue";
import type { OfflineOperation } from "../lib/offline/types";

// Simula operaciones IndexedDB readwrite con get+put dentro de la MISMA
// transacción, incluida la notificación de commit después del último write.
const rows = new Map<string, OfflineOperation>();
let storageFails = false;
type MockRequest = { result?: unknown; onsuccess?: () => void; onerror?: () => void };
type MockTransaction = {
  oncomplete?: () => void;
  onabort?: () => void;
  onerror?: () => void;
  error?: Error;
};
Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  setItem() { if (storageFails) throw new Error("Storage denied"); },
} });
Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: {
  open() {
    const opening: MockRequest = {};
    queueMicrotask(() => {
      opening.result = {
        close() {},
        transaction() {
          const tx: MockTransaction & { objectStore?: () => object } = {};
          let pending = 0;
          let done = false;
          const request = (work: () => unknown) => {
            const req: MockRequest = {};
            pending++;
            queueMicrotask(() => {
              if (done) return;
              try {
                req.result = work();
                req.onsuccess?.();
              } catch (error) {
                done = true;
                tx.error = error instanceof Error ? error : new Error(String(error));
                tx.onerror?.();
                tx.onabort?.();
              } finally {
                pending--;
                queueMicrotask(() => {
                  if (!done && pending === 0) {
                    done = true;
                    tx.oncomplete?.();
                  }
                });
              }
            });
            return req;
          };
          tx.objectStore = () => ({
            getAll: () => request(() => structuredClone([...rows.values()])),
            get: (id: string) => request(() => rows.has(id) ? structuredClone(rows.get(id)) : undefined),
            put: (row: OfflineOperation) => request(() => { rows.set(row.id, structuredClone(row)); return row.id; }),
            add: (row: OfflineOperation) => request(() => {
              if (rows.has(row.id)) throw new Error("ConstraintError");
              rows.set(row.id, structuredClone(row)); return row.id;
            }),
            delete: (id: string) => request(() => rows.delete(id)),
          });
          return tx;
        },
      };
      opening.onsuccess?.();
    });
    return opening;
  },
} });
const operation = (id: string, kind: OfflineOperation["kind"] = "pos.sale.create"): OfflineOperation => ({
  id, kind, payload: { clientOperationId: id }, createdAt: `2026-09-05T00:00:0${id}Z`, attempts: 0, status: "pending",
});
function reset(...operations: OfflineOperation[]) { rows.clear(); storageFails = false; for (const row of operations) rows.set(row.id, row); }

test("venta fallida detiene la cola; solo el reintento manual usa el mismo ID", async () => {
  reset(operation("1"), operation("2"));
  const sent: string[] = [];
  let fail = true;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body.clientOperationId);
    return Response.json({ error: "Rejected" }, { status: body.clientOperationId === "1" && fail ? 422 : 200 });
  };
  await syncOfflineQueue();
  assert.deepEqual(sent, ["1"]);
  assert.equal(rows.get("1")?.status, "failed");
  assert.equal(rows.get("2")?.status, "pending");
  fail = false;
  await syncOfflineQueue();
  assert.deepEqual(sent, ["1"]); // no auto retry
  assert.equal(await retryQueuedOperation("1"), true);
  await syncOfflineQueue();
  assert.deepEqual(sent, ["1", "1", "2"]);
  assert.equal(rows.size, 0);
});

test("respuesta perdida: requiere revisión, y el reintento conserva idempotencia", async () => {
  reset(operation("1"));
  const committed = new Map<string, string>();
  let effects = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (!committed.has(body.clientOperationId)) {
      committed.set(body.clientOperationId, String(init?.body)); effects++;
      throw new TypeError("Response lost after commit");
    }
    assert.equal(String(init?.body), committed.get(body.clientOperationId));
    return Response.json({ id: body.clientOperationId });
  };
  await syncOfflineQueue();
  assert.equal(rows.get("1")?.status, "failed");
  await syncOfflineQueue();
  assert.equal(effects, 1);
  assert.equal(rows.get("1")?.status, "failed");
  await retryQueuedOperation("1");
  await syncOfflineQueue();
  assert.equal(effects, 1);
  assert.equal(rows.size, 0);
});

test("IDs antiguos distintos quedan retenidos para conciliación y bloquean la siguiente", async () => {
  const legacy = operation("1"); legacy.payload = { clientOperationId: "original" };
  reset(legacy, operation("2"));
  const sent: string[] = [];
  globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(String(init?.body)).clientOperationId); return Response.json({}); };
  await syncOfflineQueue();
  assert.deepEqual(sent, []);
  assert.equal(rows.get("1")?.id, "1");
  assert.deepEqual(rows.get("1")?.payload, legacy.payload);
  assert.match(rows.get("1")!.lastError!, /POS_IDENTITY_REVIEW_REQUIRED/);
  assert.equal(rows.get("2")?.status, "pending");
});

test("fallo POS conserva cierre de caja y operaciones siguientes sin transmitir", async () => {
  reset(operation("1"), operation("2", "cash-cut.close"), operation("3"));
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({}, { status: 500 }); };
  await syncOfflineQueue();
  assert.equal(requests, 1);
  assert.equal(rows.get("2")?.status, "pending");
  assert.equal(rows.get("3")?.status, "pending");
});

test("cancelación es auditable y nunca se envía", async () => {
  reset(operation("1"), operation("2"));
  assert.equal(await cancelQueuedOperation("1", "Cliente desistió"), true);
  assert.equal(rows.get("1")?.status, "cancelled");
  assert.equal(await retryQueuedOperation("1"), false);
  const sent: string[] = [];
  globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(String(init?.body)).clientOperationId); return Response.json({}); };
  await syncOfflineQueue();
  assert.deepEqual(sent, ["2"]);
  assert.equal(rows.get("1")?.status, "cancelled");
});

test("una operación atrapada en syncing requiere conciliación, nunca reenvío automático", async () => {
  const inFlight = operation("1"); inFlight.status = "syncing";
  reset(inFlight, operation("2"));
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({}); };
  await syncOfflineQueue();
  assert.equal(requests, 0);
  assert.equal(rows.get("1")?.status, "syncing");
  assert.equal(rows.get("2")?.status, "pending");
});

test("falla de localStorage después de respuesta exitosa no revive la venta", async () => {
  reset(operation("1")); storageFails = true;
  globalThis.fetch = async () => Response.json({});
  await assert.doesNotReject(syncOfflineQueue());
  assert.equal(rows.size, 0);
});

test("rechazo por sucursal distinta conserva el error y no manda recibos ni cierra caja", async () => {
  const sale = operation("1");
  sale.payload = { clientOperationId: "1", branchId: "canoas" };
  const receipt = operation("2", "pos.sale.email");
  receipt.payload = { saleId: "1" };
  reset(sale, receipt, operation("3", "cash-cut.close"));
  const message = "Tienes un corte abierto en Colotlán Centro. Cierra ese corte antes de operar en otra sucursal.";
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ error: { code: "CASH_SESSION_NOT_OPEN", message, retryable: false } }, { status: 409 });
  };
  await syncOfflineQueue();
  assert.equal(requests, 1);
  assert.equal(rows.get("1")?.status, "failed");
  assert.equal(rows.get("1")?.lastError, message);
  assert.deepEqual(rows.get("1")?.payload, sale.payload);
  assert.equal(rows.get("2")?.status, "pending");
  assert.equal(rows.get("3")?.status, "pending");
});
