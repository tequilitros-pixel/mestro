"use client";

import { claimQueuedOperation, completeClaimedOperation, failClaimedOperation, listOperations } from "./queue";
import { offlineQueueDecision } from "./syncPolicy";

let activeSync: Promise<void> | null = null;

export function syncOfflineQueue() {
  if (activeSync) return activeSync;

  activeSync = runSync().finally(() => {
    activeSync = null;
    window.dispatchEvent(new Event("maestro:sync-finished"));
  });

  return activeSync;
}

async function runSync() {
  if (!navigator.onLine) return;

  const operations = await listOperations();
  // Mantener el orden del dispositivo: una operación fallida o interrumpida
  // exige conciliación antes de enviar las siguientes. Las canceladas quedan
  // como evidencia local y jamás se transmiten.
  for (const queued of operations) {
    if (!navigator.onLine) break;
    const decision = offlineQueueDecision(queued.status);
    if (decision === "skip") continue;
    if (decision === "stop") break;

    // Un recibo depende de la venta que lo originó. Si esa venta sigue en
    // la cola (incluso en otra pestaña), no se adelanta el correo.
    if (queued.kind === "pos.sale.email") {
      const saleId = String((queued.payload as Record<string, unknown>).saleId ?? "");
      if (operations.some((item) =>
        item.kind === "pos.sale.create" &&
        (item.id === saleId || String((item.payload as Record<string, unknown>).saleId ?? "") === saleId) &&
        item.status !== "cancelled",
      )) break;
    }

    const operation = await claimQueuedOperation(queued.id);
    if (!operation) break; // Otro tab ya lo tomó, canceló o actualizó.

    try {
      // Las colas antiguas podían asignar dos IDs al mismo cobro. No sabemos
      // cuál recibió el servidor: conservar ambos y exigir conciliación.
      const originalId = (operation.payload as Record<string, unknown>).clientOperationId;
      if (operation.kind === "pos.sale.create" && originalId && originalId !== operation.id) {
        throw new Error("POS_IDENTITY_REVIEW_REQUIRED: El cobro conserva dos identificadores. Verifica la venta en servidor antes de reintentar.");
      }
      const endpoint = operation.kind === "pos.sale.create"
        ? "/api/pos/sales"
        : operation.kind === "pos.sale.email"
          ? `/api/pos/sales/${String((operation.payload as Record<string, unknown>).saleId)}/receipt-email`
          : operation.kind.startsWith("timeclock.")
            ? "/api/timeclock/sync"
          : operation.kind === "cash-cut.open"
            ? "/api/cash-cuts"
            : operation.kind === "cash-cut.inflow.create"
              ? `/api/cash-cuts/${String((operation.payload as Record<string, unknown>).cashCutId)}/entradas`
              : operation.kind === "cash-cut.outflow.create"
                ? `/api/cash-cuts/${String((operation.payload as Record<string, unknown>).cashCutId)}/salidas`
                : operation.kind === "cash-cut.close"
                  ? `/api/cash-cuts/${String((operation.payload as Record<string, unknown>).cashCutId)}/cerrar`
                  : operation.kind === "cash-cut.venta.set"
                    ? `/api/cash-cuts/${String((operation.payload as Record<string, unknown>).cashCutId)}/ventas`
          : "/api/sync/operations";
      const directApiOperation = operation.kind === "pos.sale.create" || operation.kind === "pos.sale.email" || operation.kind.startsWith("cash-cut.");
      const body = directApiOperation
        ? { ...operation.payload, clientOperationId: operation.id, clientCreatedAt: operation.createdAt }
        : operation;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("La sesión no está autorizada para sincronizar");
      }

      const result = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string | { message?: string } }
        | null;

      const accepted = directApiOperation
        ? response.ok
        : response.ok && result?.success;
      if (!accepted) {
        const message = typeof result?.error === "string" ? result.error : result?.error?.message;
        throw new Error(message ?? `Error de sincronización (${response.status})`);
      }

      await completeClaimedOperation(operation.id);
      try {
        localStorage.setItem("maestro:last-synced-at", new Date().toISOString());
      } catch {
        // Un fallo del indicador no debe volver a encolar una venta confirmada.
      }
    } catch (error) {
      await failClaimedOperation(
        operation.id,
        error instanceof Error ? error.message : "Error desconocido",
      );
      // No sincronizar movimientos dependientes ni otras ventas hasta que
      // se reconcilie o se reintente explícitamente la operación fallida.
      break;
    }
  }
}
