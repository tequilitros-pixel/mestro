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

export async function listLocalPendingTabs(branchId?: string): Promise<PendingTab[]> {
  try {
    const db = await openDatabase();
    const tabs = await new Promise<PendingTab[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as PendingTab[]);
      request.onerror = () => reject(request.error);
    });
    db.close();

    const filtered = branchId ? tabs.filter((t) => t.branchId === branchId) : tabs;
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

  // Si hay conexión, intentar persistir en servidor
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      void fetch("/api/pos/pending-tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      }).catch(() => {});
    } catch {
      // Ignora error silencioso para no bloquear UI local
    }
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

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      void fetch(`/api/pos/pending-tabs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch {
      // Ignora error silencioso
    }
  }
}

/**
 * Sincroniza las cuentas del servidor con el IndexedDB local para compartir cuentas entre dispositivos.
 */
export async function syncPendingTabs(branchId?: string): Promise<PendingTab[]> {
  const localTabs = await listLocalPendingTabs(branchId);

  if (typeof navigator === "undefined" || !navigator.onLine) {
    return localTabs;
  }

  try {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const response = await fetch(`/api/pos/pending-tabs${query}`);
    if (!response.ok) return localTabs;

    const serverTabs = (await response.json()) as PendingTab[];
    if (!Array.isArray(serverTabs)) return localTabs;

    // Fusionar: si el servidor tiene cuentas más recientes o nuevas, guardarlas localmente
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const localMap = new Map(localTabs.map((t) => [t.id, t]));

    for (const serverTab of serverTabs) {
      const local = localMap.get(serverTab.id);
      if (!local || new Date(serverTab.updatedAt) > new Date(local.updatedAt)) {
        store.put(serverTab);
      }
    }

    // Si local tiene cuentas creadas offline que el servidor no tiene, subirlas al servidor
    const serverMap = new Map(serverTabs.map((t) => [t.id, t]));
    for (const local of localTabs) {
      if (!serverMap.has(local.id)) {
        void fetch("/api/pos/pending-tabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(local),
        }).catch(() => {});
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    return listLocalPendingTabs(branchId);
  } catch {
    return localTabs;
  }
}
