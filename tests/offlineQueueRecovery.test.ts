import assert from "node:assert/strict";
import test from "node:test";
import { syncOfflineQueue } from "../lib/offline/sync";
import type { OfflineOperation } from "../lib/offline/types";

// Minimal IndexedDB request harness: exercise the real queue and sync functions.
const rows = new Map<string, OfflineOperation>();
let storageFails = false;
Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  setItem() { if (storageFails) throw new Error("Storage denied"); },
} });
Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: {
  open() {
    const opening: any = {};
    queueMicrotask(() => {
      opening.result = {
        close() {},
        transaction() {
          const tx: any = {};
          const request = (work: () => unknown) => {
            const result: any = {};
            queueMicrotask(() => { result.result = work(); result.onsuccess?.(); tx.oncomplete?.(); });
            return result;
          };
          tx.objectStore = () => ({
            getAll: () => request(() => structuredClone([...rows.values()])),
            put: (row: OfflineOperation) => request(() => { rows.set(row.id, structuredClone(row)); return row.id; }),
            delete: (id: string) => request(() => rows.delete(id)),
          });
          return tx;
        },
      };
      opening.onsuccess();
    });
    return opening;
  },
} });
const operation = (id: string, kind: OfflineOperation["kind"] = "pos.sale.create"): OfflineOperation => ({
  id, kind, payload: { clientOperationId: id }, createdAt: `2026-09-05T00:00:0${id}Z`, attempts: 0, status: "pending",
});
function reset(...operations: OfflineOperation[]) { rows.clear(); storageFails = false; for (const row of operations) rows.set(row.id, row); }

test("failed sale does not block a later sale, and retry preserves the ID", async () => {
  reset(operation("1"), operation("2"));
  const sent: string[] = [];
  let fail = true;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); sent.push(body.clientOperationId);
    return Response.json({ error: "Rejected" }, { status: body.clientOperationId === "1" && fail ? 422 : 200 });
  };
  await syncOfflineQueue();
  assert.deepEqual(sent, ["1", "2"]);
  assert.equal(rows.get("1")?.status, "failed");
  assert.equal(rows.has("2"), false);
  fail = false;
  await syncOfflineQueue();
  assert.deepEqual(sent, ["1", "2", "1"]);
  assert.equal(rows.size, 0);
});

test("lost server response replays identical request without another simulated sale/payment/inventory effect", async () => {
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
  assert.equal(rows.size, 0);
});

test("legacy mismatched IDs are retained without risking a duplicate; next sale continues", async () => {
  const legacy = operation("1"); legacy.payload = { clientOperationId: "original" };
  reset(legacy, operation("2"));
  const sent: string[] = [];
  globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(String(init?.body)).clientOperationId); return Response.json({}); };
  await syncOfflineQueue();
  assert.deepEqual(sent, ["2"]);
  assert.equal(rows.get("1")?.id, "1");
  assert.deepEqual(rows.get("1")?.payload, legacy.payload);
  assert.match(rows.get("1")!.lastError!, /POS_IDENTITY_REVIEW_REQUIRED/);
});

test("failed sale preserves subsequent cash closing and dependent operations", async () => {
  reset(operation("1"), operation("2", "cash-cut.close"), operation("3"));
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({}, { status: 500 }); };
  await syncOfflineQueue();
  assert.equal(requests, 1);
  assert.equal(rows.get("2")?.status, "pending");
  assert.equal(rows.get("3")?.status, "pending");
});

test("localStorage failure after acknowledgment does not reject or resurrect sale", async () => {
  reset(operation("1")); storageFails = true;
  globalThis.fetch = async () => Response.json({});
  await assert.doesNotReject(syncOfflineQueue());
  assert.equal(rows.size, 0);
});
