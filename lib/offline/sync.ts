"use client";

import { listOperations, removeOperation, updateOperation } from "./queue";

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

  for (const operation of operations) {
    if (!navigator.onLine) break;

    const syncing = { ...operation, status: "syncing" as const };
    await updateOperation(syncing);

    try {
      const endpoint = operation.kind === "pos.sale.create"
        ? "/api/pos/sales"
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
          : "/api/sync/operations";
      const directApiOperation = operation.kind === "pos.sale.create" || operation.kind.startsWith("cash-cut.");
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
        | { success?: boolean; error?: string }
        | null;

      const accepted = directApiOperation
        ? response.ok
        : response.ok && result?.success;
      if (!accepted) {
        throw new Error(result?.error ?? `Error de sincronización (${response.status})`);
      }

      await removeOperation(operation.id);
      localStorage.setItem("maestro:last-synced-at", new Date().toISOString());
    } catch (error) {
      await updateOperation({
        ...operation,
        attempts: operation.attempts + 1,
        status: "failed",
        lastError: error instanceof Error ? error.message : "Error desconocido",
      });

      // La cola es cronológica y algunas operaciones dependen de la anterior
      // (abrir corte → movimientos/ventas → cerrar). No adelantamos eventos.
      break;
    }
  }
}
