"use client";

import { claimQueuedOperation, listOperations, removeOperation, updateOperation } from "./queue";
import { describeSyncFailure, getUnconfirmedSaleIds, shouldAutomaticallySyncOperation } from "./syncPolicy";

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
  let blocked = false;
  const failedSaleIds = getUnconfirmedSaleIds(operations);

  for (const operation of operations) {
    if (!navigator.onLine) break;
    // Cancelled sales are audit-only. Failed sales require an explicit retry
    // rather than being re-sent by the 30-second background sync loop.
    if (!shouldAutomaticallySyncOperation(operation)) {
      if (operation.kind === "pos.sale.create" && operation.status === "failed") blocked = true;
      continue;
    }
    const saleId = String((operation.payload as Record<string, unknown>).saleId ?? "");
    // Un recibo electrónico sólo puede salir después de que su venta esté
    // confirmada. Nunca enviamos un comprobante de un cobro que el servidor
    // rechazó o que sigue pendiente de sincronizar.
    if (operation.kind === "pos.sale.email" && failedSaleIds.has(saleId)) continue;
    // No adelantar ventas a una apertura/cierre de caja que quedó pendiente.
    if (blocked && operation.kind.startsWith("cash-cut.")) break;
    // Las ventas y correos de recibo son independientes; conserva el orden de los demás eventos.
    if (blocked && operation.kind !== "pos.sale.create" && operation.kind !== "pos.sale.email") continue;

    // Atomically check current state and claim this id; another tab may
    // have cancelled or started synchronizing it since listOperations().
    const syncing = await claimQueuedOperation(operation.id);
    if (!syncing) continue;

    try {
      // Las colas antiguas podían asignar dos IDs al mismo cobro. No sabemos
      // cuál recibió el servidor: conservar ambos y exigir conciliación.
      const originalId = (syncing.payload as Record<string, unknown>).clientOperationId;
      if (syncing.kind === "pos.sale.create" && originalId && originalId !== syncing.id) {
        throw new Error("POS_IDENTITY_REVIEW_REQUIRED: El cobro conserva dos identificadores. Verifica la venta en servidor antes de reintentar.");
      }
      const endpoint = syncing.kind === "pos.sale.create"
        ? "/api/pos/sales"
        : syncing.kind === "pos.sale.email"
          ? `/api/pos/sales/${String((syncing.payload as Record<string, unknown>).saleId)}/receipt-email`
          : syncing.kind.startsWith("timeclock.")
            ? "/api/timeclock/sync"
          : syncing.kind === "cash-cut.open"
            ? "/api/cash-cuts"
            : syncing.kind === "cash-cut.inflow.create"
              ? `/api/cash-cuts/${String((syncing.payload as Record<string, unknown>).cashCutId)}/entradas`
              : syncing.kind === "cash-cut.outflow.create"
                ? `/api/cash-cuts/${String((syncing.payload as Record<string, unknown>).cashCutId)}/salidas`
                : syncing.kind === "cash-cut.close"
                  ? `/api/cash-cuts/${String((syncing.payload as Record<string, unknown>).cashCutId)}/cerrar`
                  : syncing.kind === "cash-cut.venta.set"
                    ? `/api/cash-cuts/${String((syncing.payload as Record<string, unknown>).cashCutId)}/ventas`
          : "/api/sync/operations";
      const directApiOperation = syncing.kind === "pos.sale.create" || syncing.kind === "pos.sale.email" || syncing.kind.startsWith("cash-cut.");
      const body = directApiOperation
        ? { ...syncing.payload, clientOperationId: syncing.id, clientCreatedAt: syncing.createdAt }
        : operation;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: unknown; message?: unknown }
        | null;

      if (response.status === 401 || response.status === 403) {
        throw new Error(describeSyncFailure(result, response.status));
      }

      const accepted = directApiOperation
        ? response.ok
        : response.ok && result?.success;
      if (!accepted) {
        throw new Error(describeSyncFailure(result, response.status));
      }

      await removeOperation(syncing.id);
      try {
        localStorage.setItem("maestro:last-synced-at", new Date().toISOString());
      } catch {
        // Un fallo del indicador no debe volver a encolar una venta confirmada.
      }
    } catch (error) {
      if (operation.kind === "pos.sale.create") failedSaleIds.add(operation.id);
      await updateOperation({
        ...syncing,
        attempts: syncing.attempts + 1,
        status: "failed",
        syncStartedAt: undefined,
        lastError: error instanceof Error ? error.message : "Error desconocido",
      });

      blocked = true;
      if (operation.kind.startsWith("cash-cut.")) break;
    }
  }
}
