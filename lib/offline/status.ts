import type { SyncSnapshot } from "./types";

export function formatSyncStatusLabel(snapshot: SyncSnapshot): string {
  if (!snapshot.online) {
    const queued = snapshot.pending + snapshot.failed;
    return `Sin conexión${queued ? ` · ${queued} pendientes` : ""}`;
  }
  if (snapshot.syncing) return `Sincronizando · ${snapshot.pending} pendientes`;
  if (snapshot.failed) {
    const pending = snapshot.pending ? ` · ${snapshot.pending} pendientes` : "";
    return `${snapshot.failed} con error${pending} · Reintentar`;
  }
  return snapshot.pending ? `${snapshot.pending} pendientes` : "En línea";
}
