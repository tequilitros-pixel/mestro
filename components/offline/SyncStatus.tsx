"use client";

import { useOfflineSync } from "./OfflineProvider";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { formatSyncStatusLabel } from "@/lib/offline/status";

export default function SyncStatus() {
  const { snapshot, syncNow } = useOfflineSync();

  const label = formatSyncStatusLabel(snapshot);

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
      title={snapshot.lastSyncedAt ? `Última sincronización: ${formatBusinessDateTime(snapshot.lastSyncedAt)}` : "Sin sincronizaciones registradas"}
      className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface-variant"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </button>
  );
}
