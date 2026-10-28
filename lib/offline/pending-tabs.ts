"use client";

export type PendingTabLine = {
  key: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
};

export type PendingTabStatus = "PENDIENTE" | "PAGADA" | "CANCELADA";

export type PendingTab = {
  id: string;
  branchId: string;
  cashCutId: string;
  customerName: string;
  phone?: string;
  notes?: string;
  status: PendingTabStatus;
  lines: PendingTabLine[];
  total: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  saleId?: string | null;
  saleCode?: string | null;
};

const DATABASE_NAME = "maestro-pospress-pending-tabs";
const STORE_NAME = "pending_tabs";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("branchId", "branchId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function calculateTotal(lines: PendingTabLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export async function listLocalPendingTabs(branchId?: string, cashCutId?: string): Promise<PendingTab[]> {
  try {
    const db = await openDatabase();
    const tabs = await new Promise<PendingTab[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as PendingTab[]);
      request.onerror = () => reject(request.error);
    });
    db.close();

    const filtered = tabs.filter((tab) =>
      (!branchId || tab.branchId === branchId) &&
      (!cashCutId || tab.cashCutId === cashCutId),
    );
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function getLocalPendingTab(id: string): Promise<PendingTab | null> {
  try {
    const db = await openDatabase();
    const tab = await new Promise<PendingTab | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as PendingTab | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return tab ?? null;
  } catch {
    return null;
  }
}

export async function saveLocalPendingTab(tab: PendingTab): Promise<PendingTab> {
  const normalized: PendingTab = {
    ...tab,
    total: calculateTotal(tab.lines),
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("Error guardando en IndexedDB:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("maestro:pending-tabs-changed", { detail: normalized }));
  }

  return normalized;
}

export async function deleteLocalPendingTab(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("Error borrando en IndexedDB:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("maestro:pending-tabs-changed", { detail: { id, deleted: true } }));
  }

}

/**
 * Las cuentas pendientes se conservan en el dispositivo que las creó. No se
 * simulan como sincronizadas: una venta sólo se registra por la ruta auditada
 * de POS cuando se liquida la cuenta.
 */
export async function syncPendingTabs(branchId?: string, cashCutId?: string): Promise<PendingTab[]> {
  return listLocalPendingTabs(branchId, cashCutId);
}
