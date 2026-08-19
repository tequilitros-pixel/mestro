"use client";

import { useOfflineSync } from "./OfflineProvider";

export default function SyncStatus() {
  const { snapshot, syncNow } = useOfflineSync();

  const label = !snapshot.online
    ? `Sin conexión${snapshot.pending ? ` · ${snapshot.pending} pendientes` : ""}`
    : snapshot.syncing
      ? `Sincronizando · ${snapshot.pending} pendientes`
      : snapshot.failed
        ? `${snapshot.failed} con error · Reintentar`
        : snapshot.pending
          ? `${snapshot.pending} pendientes`
          : "En línea";

  const color = !snapshot.online
    ? "bg-amber-500"
    : snapshot.failed
      ? "bg-error"
      : snapshot.syncing || snapshot.pending
        ? "bg-on-surface-variant"
        : "bg-emerald-500";

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={snapshot.lastSyncedAt ? `Última sincronización: ${new Date(snapshot.lastSyncedAt).toLocaleString("es-MX")}` : "Sin sincronizaciones registradas"}
      className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface-variant"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </button>
  );
}
