"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { listOperations } from "@/lib/offline/queue";
import { syncOfflineQueue } from "@/lib/offline/sync";
import type { SyncSnapshot } from "@/lib/offline/types";

const initialSnapshot: SyncSnapshot = {
  online: true,
  pending: 0,
  syncing: false,
  failed: 0,
  lastSyncedAt: null,
};

const OfflineContext = createContext({
  snapshot: initialSnapshot,
  syncNow: async () => {},
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  const refresh = useCallback(async () => {
    try {
      const operations = await listOperations();
      const lastSyncedAt = localStorage.getItem("maestro:last-synced-at");
      const next = {
        online: navigator.onLine,
        pending: operations.filter((operation) => operation.status === "pending").length,
        syncing: operations.some((operation) => operation.status === "syncing"),
        failed: operations.filter((operation) => operation.status === "failed").length,
        lastSyncedAt: lastSyncedAt && Number.isFinite(new Date(lastSyncedAt).getTime()) ? lastSyncedAt : null,
      };
      setSnapshot((current) => ({ ...current, ...next }));
    } catch (error) {
      console.error("No fue posible leer el estado de sincronización", error);
      setSnapshot((current) => ({ ...current, syncing: false, syncError: "No fue posible leer la cola local." }));
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSnapshot((current) => ({ ...current, syncError: null }));
    try {
      await refresh();
      await syncOfflineQueue();
    } catch (error) {
      console.error("No fue posible sincronizar la cola local", error);
      setSnapshot((current) => ({ ...current, syncing: false, syncError: "No fue posible sincronizar la cola local." }));
    } finally {
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    const handleChange = () => void refresh();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleChange);
    window.addEventListener("maestro:queue-changed", handleChange);
    window.addEventListener("maestro:sync-finished", handleChange);
    const initialRefresh = window.setTimeout(() => {
      void syncNow();
      void (async () => {
        try {
          if ("serviceWorker" in navigator) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch (error) {
          console.error("No fue posible registrar el modo offline", error);
        }
      })();
    }, 0);

    const interval = window.setInterval(() => void syncNow(), 30_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleChange);
      window.removeEventListener("maestro:queue-changed", handleChange);
      window.removeEventListener("maestro:sync-finished", handleChange);
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh, syncNow]);

  return (
    <OfflineContext.Provider value={{ snapshot, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineSync() {
  return useContext(OfflineContext);
}
