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
    store.add({ ...operation, attempts: 0, status: "pending" } satisfies OfflineOperation),
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
 * Cambios de estado atómicos en IndexedDB. Lectura+escritura ocurren dentro
 * de UNA transacción readwrite para que otra pestaña no reenvíe una venta
 * cancelada ni reclame el mismo cobro dos veces.
 */
async function mutateOperation<T>(
  id: string,
  allowedStatuses: OfflineOperation["status"][],
  mutate: (operation: OfflineOperation, store: IDBObjectStore) => T,
): Promise<T | null> {
  const db = await openDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(OPERATIONS_STORE, "readwrite");
    const store = tx.objectStore(OPERATIONS_STORE);
    let value: T | null = null;
    const get = store.get(id);
    get.onsuccess = () => {
      const operation = get.result as OfflineOperation | undefined;
      if (operation && allowedStatuses.includes(operation.status)) {
        value = mutate(operation, store);
      }
    };
    tx.oncomplete = () => {
      db.close();
      if (value !== null) window.dispatchEvent(new Event("maestro:queue-changed"));
      resolve(value);
    };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Error al guardar la cola offline")); };
    tx.onerror = () => { /* onabort rejects with the transaction error */ };
  });
}

/** Reclama solamente operaciones pendientes, de manera indivisible. */
export async function claimQueuedOperation(id: string): Promise<OfflineOperation | null> {
  return mutateOperation(id, ["pending"], (operation, store) => {
    store.put({ ...operation, status: "syncing", syncStartedAt: new Date().toISOString() } satisfies OfflineOperation);
    return operation;
  });
}

export async function failClaimedOperation(id: string, reason: string) {
  return (await mutateOperation(id, ["syncing"], (operation, store) => {
    store.put({
      ...operation,
      status: "failed",
      attempts: operation.attempts + 1,
      lastError: reason,
      syncStartedAt: undefined,
    } satisfies OfflineOperation);
    return true;
  })) === true;
}

export async function completeClaimedOperation(id: string) {
  return (await mutateOperation(id, ["syncing"], (_operation, store) => {
    store.delete(id);
    return true;
  })) === true;
}

/** Cancelar jamás borra un cobro ni interrumpe uno que el servidor ya procesa. */
export async function cancelQueuedOperation(id: string, reason?: string) {
  return (await mutateOperation(id, ["pending", "failed"], (operation, store) => {
    if (operation.kind !== "pos.sale.create") return false;
    store.put({
      ...operation,
      status: "cancelled",
      lastError: reason?.trim() || "Cancelada en el dispositivo antes de sincronizar.",
    } satisfies OfflineOperation);
    return true;
  })) === true;
}

/** Sólo una acción humana vuelve a activar una operación fallida. */
export async function retryQueuedOperation(id: string) {
  return (await mutateOperation(id, ["failed"], (operation, store) => {
    store.put({ ...operation, status: "pending", lastError: undefined } satisfies OfflineOperation);
    return true;
  })) === true;
}

/**
 * El servidor pudo haber cobrado aunque el navegador se cerrara.
 * Solo una acción explícita del usuario marca una operación antigua
 * "syncing" como fallida para iniciar una conciliación MANUAL.
 */
export async function flagInterruptedOperationForReview(id: string) {
  return (await mutateOperation(id, ["syncing"], (operation, store) => {
    const timestamp = new Date(operation.syncStartedAt ?? operation.createdAt).getTime();
    if (Number.isFinite(timestamp) && Date.now() - timestamp < 5 * 60_000) return false;
    store.put({
      ...operation,
      status: "failed",
      lastError: "Sin confirmación del servidor. Revisa el historial de ventas antes de reintentar.",
      syncStartedAt: undefined,
    } satisfies OfflineOperation);
    return true;
  })) === true;
}
