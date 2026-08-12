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
    const operations = await listOperations();
    setSnapshot((current) => ({
      ...current,
      online: navigator.onLine,
      pending: operations.length,
      syncing: operations.some((operation) => operation.status === "syncing"),
      failed: operations.filter((operation) => operation.status === "failed").length,
      lastSyncedAt: localStorage.getItem("maestro:last-synced-at"),
    }));
  }, []);

  const syncNow = useCallback(async () => {
    await refresh();
    await syncOfflineQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    const handleChange = () => void refresh();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleChange);
    window.addEventListener("maestro:queue-changed", handleChange);
    window.addEventListener("maestro:sync-finished", handleChange);
    const initialRefresh = window.setTimeout(() => {
      void refresh().then(() => syncOfflineQueue());
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
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
