import type { OfflineOperation } from "./types";

type QueueOperation = Pick<OfflineOperation, "id" | "kind" | "status">;

/**
 * A failed sale needs explicit review before another attempt. Cancelled entries
 * are retained for audit, but must never be sent to the server.
 * Other failed operation types keep their previous automatic-retry behavior.
 */
export function shouldAutomaticallySyncOperation(operation: QueueOperation): boolean {
  if (operation.status === "cancelled") return false;
  if (operation.kind === "pos.sale.create" && operation.status === "failed") return false;
  return true;
}

/** Prevent sending receipts for a sale that is still failed or cancelled locally. */
export function getUnconfirmedSaleIds(operations: readonly QueueOperation[]): Set<string> {
  return new Set(
    operations
      .filter(
        (operation) =>
          operation.kind === "pos.sale.create" &&
          (operation.status === "failed" || operation.status === "cancelled"),
      )
      .map((operation) => operation.id),
  );
}

/** Errors returned by the POS API can be strings or structured DomainError objects. */
export function describeSyncFailure(responseBody: unknown, httpStatus: number): string {
  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)) {
    const body = responseBody as Record<string, unknown>;
    const error = body.error;
    if (typeof error === "string" && error.trim()) return error.trim();
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const details = error as Record<string, unknown>;
      const message = typeof details.message === "string" ? details.message.trim() : "";
      const code = typeof details.code === "string" ? details.code.trim() : "";
      if (message) return code ? `${message} (código: ${code})` : message;
      if (code) return `Error de sincronización: ${code} (HTTP ${httpStatus}).`;
    }
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return `La sesión no está autorizada para sincronizar (HTTP ${httpStatus}).`;
  }
  return `Error de sincronización (HTTP ${httpStatus}).`;
}

/** Identity/cash-cut conflicts cannot be resolved safely by blind retries. */
export function needsPosSaleReconciliation(lastError?: string): boolean {
  return /POS_IDENTITY_REVIEW_REQUIRED|IDEMPOTENCY_KEY_REUSED|CASH_SESSION_NOT_OPEN|POS_CASH_CUT_REVIEW_REQUIRED/.test(lastError ?? "");
}
