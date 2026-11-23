import type { OfflineOperationStatus } from "./types";

/**
 * Una solicitud que ya fue cancelada, falló o perdió confirmación por
 * cierre de pestaña no debe volver a enviarse automáticamente.
 */
export function offlineQueueDecision(status: OfflineOperationStatus):
  "skip" | "stop" | "claim" {
  if (status === "cancelled") return "skip";
  if (status === "failed" || status === "syncing") return "stop";
  return "claim";
}
