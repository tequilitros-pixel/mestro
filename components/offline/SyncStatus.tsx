"use client";

import { useOfflineSync } from "./OfflineProvider";
import { flagInterruptedOperationForReview, listOperations, retryQueuedOperation } from "@/lib/offline/queue";
import { useState } from "react";
import { formatBusinessDateTime } from "@/lib/dateTime";
import { formatSyncStatusLabel } from "@/lib/offline/status";

export default function SyncStatus() {
  const { snapshot, syncNow } = useOfflineSync();
  const [reviewing, setReviewing] = useState(false);

  async function handleClick() {
    if (reviewing) return;
    setReviewing(true);
    try {
      if (snapshot.syncing) {
        const inFlight = (await listOperations()).find((operation) => operation.status === "syncing");
        if (inFlight && window.confirm(
          "Hay una operación que no recibió confirmación. Antes de recuperarla verifica si la venta existe en el historial del POS. ¿Marcarla para revisión manual?",
        )) {
          const changed = await flagInterruptedOperationForReview(inFlight.id);
          if (!changed) window.alert("Todavía se está procesando o no han transcurrido 5 minutos. No se ha reenviado.");
        }
        return;
      }
      if (snapshot.failed > 0) {
        const failed = (await listOperations()).find((operation) => operation.status === "failed");
        if (!failed) return;
        if (failed.lastError?.includes("POS_IDENTITY_REVIEW_REQUIRED")) {
          window.alert("Hay dos identificadores para la misma venta. Solicita conciliación administrativa; no se puede reintentar automáticamente.");
          return;
        }
        if (!window.confirm(
          "Antes de reintentar, revisa si este cobro ya aparece registrado en el servidor. El reintento usará el mismo identificador, sin cambiar el monto. ¿Confirmas que revisaste y quieres reintentar la operación pendiente?",
        )) return;
        if (await retryQueuedOperation(failed.id)) await syncNow();
        return;
      }
      await syncNow();
    } catch {
      window.alert("No se pudo revisar la cola offline. Conserva este dispositivo y vuelve a intentarlo.");
    } finally {
      setReviewing(false);
    }
  }

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
      disabled={reviewing}
      onClick={() => void handleClick()}
      title={snapshot.lastSyncedAt ? `Última sincronización: ${formatBusinessDateTime(snapshot.lastSyncedAt)}` : "Sin sincronizaciones registradas"}
      className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface-variant"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </button>
  );
}
