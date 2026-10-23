"use client";

export type LocalTableLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
};

export type LocalTableOrder = {
  id: string;
  branchId: string;
  tableId: string;
  tableLabel: string;
  lines: LocalTableLine[];
  createdAt: string;
  updatedAt: string;
};

const DATABASE_NAME = "maestro-pospress-tables";
const STORE_NAME = "orders";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeOrder(order: LocalTableOrder) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(order);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  window.dispatchEvent(new Event("maestro:tables-changed"));
}

export async function listLocalTableOrders() {
  const database = await openDatabase();
  const orders = await new Promise<LocalTableOrder[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as LocalTableOrder[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return orders.sort((a, b) => a.tableLabel.localeCompare(b.tableLabel, "es"));
}

export async function saveLocalTableOrder(order: LocalTableOrder) {
  await writeOrder({ ...order, updatedAt: new Date().toISOString() });
}

export async function deleteLocalTableOrder(id: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  window.dispatchEvent(new Event("maestro:tables-changed"));
}
