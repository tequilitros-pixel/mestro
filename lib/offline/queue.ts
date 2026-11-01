"use client";

import type { OfflineOperation } from "./types";
import { canClaimForSync, needsPosSaleReconciliation } from "./syncPolicy";

const DATABASE_NAME = "maestro-offline";
const DATABASE_VERSION = 1;
const OPERATIONS_STORE = "operations";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
        const store = database.createObjectStore(OPERATIONS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transactStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OPERATIONS_STORE, mode);
    const request = operation(transaction.objectStore(OPERATIONS_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function enqueueOperation(
  operation: Omit<OfflineOperation, "attempts" | "status">,
) {
  await transactStore("readwrite", (store) =>
    store.put({ ...operation, attempts: 0, status: "pending" } satisfies OfflineOperation),
  );
  window.dispatchEvent(new Event("maestro:queue-changed"));
}

export async function listOperations(): Promise<OfflineOperation[]> {
  const operations = await transactStore<OfflineOperation[]>("readonly", (store) =>
    store.getAll(),
  );
  return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateOperation(operation: OfflineOperation) {
  await transactStore("readwrite", (store) => store.put(operation));
  window.dispatchEvent(new Event("maestro:queue-changed"));
}

export async function removeOperation(id: string) {
  await transactStore("readwrite", (store) => store.delete(id));
  window.dispatchEvent(new Event("maestro:queue-changed"));
}

/**
 * Atomic read-modify-write transaction. Prevents another browser tab from
 * resending a sale or overriding a local cancellation between two awaits.
 */
async function transitionOperation(
  id: string,
  transition: (operation: OfflineOperation) => OfflineOperation | null,
): Promise<OfflineOperation | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(OPERATIONS_STORE, "readwrite");
    const store = tx.objectStore(OPERATIONS_STORE);
    const request = store.get(id);
    let updated: OfflineOperation | null = null;

    request.onsuccess = () => {
      const current = request.result as OfflineOperation | undefined;
      if (!current) return;
      updated = transition(current);
      if (updated) store.put(updated);
    };
    tx.oncomplete = () => {
      database.close();
      if (updated) window.dispatchEvent(new Event("maestro:queue-changed"));
      resolve(updated);
    };
    const failed = () => {
      database.close();
      reject(tx.error ?? new Error("No se pudo actualizar la transacción local."));
    };
    tx.onerror = failed;
    tx.onabort = failed;
  });
}

/** One atomic claim per operation, safe across browser tabs and refreshes. */
export async function claimQueuedOperation(id: string): Promise<OfflineOperation | null> {
  return transitionOperation(id, (operation) => {
    if (!canClaimForSync(operation)) return null;
    return { ...operation, status: "syncing", syncStartedAt: new Date().toISOString() };
  });
}

/** Cancela una operación POS pendiente sin borrar su rastro local. */
export async function cancelQueuedOperation(id: string, reason?: string) {
  const updated = await transitionOperation(id, (operation) => {
    if (operation.kind !== "pos.sale.create" || operation.status === "syncing" || operation.status === "cancelled") return null;
    return {
      ...operation,
      status: "cancelled",
      syncStartedAt: undefined,
      lastError: reason?.trim() || "Cancelada en el dispositivo antes de sincronizar.",
    };
  });
  return updated !== null;
}

export async function retryQueuedOperation(id: string) {
  const updated = await transitionOperation(id, (operation) => {
    if (operation.status === "syncing" || operation.status === "cancelled") return null;
    if (operation.kind === "pos.sale.create" && needsPosSaleReconciliation(operation.lastError)) return null;
    return { ...operation, status: "pending", syncStartedAt: undefined, lastError: undefined };
  });
  return updated !== null;
}
