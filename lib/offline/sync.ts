"use client";

import { listOperations, removeOperation, updateOperation } from "./queue";
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

    const syncing = { ...operation, status: "syncing" as const };
    await updateOperation(syncing);

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

      await removeOperation(operation.id);
      try {
        localStorage.setItem("maestro:last-synced-at", new Date().toISOString());
      } catch {
        // Un fallo del indicador no debe volver a encolar una venta confirmada.
      }
    } catch (error) {
      if (operation.kind === "pos.sale.create") failedSaleIds.add(operation.id);
      await updateOperation({
        ...operation,
        attempts: operation.attempts + 1,
        status: "failed",
        lastError: error instanceof Error ? error.message : "Error desconocido",
      });

      blocked = true;
      if (operation.kind.startsWith("cash-cut.")) break;
    }
  }
}
