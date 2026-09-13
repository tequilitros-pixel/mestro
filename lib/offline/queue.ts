"use client";

import type { OfflineOperation } from "./types";

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
