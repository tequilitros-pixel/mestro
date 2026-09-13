export const POS2_OFFLINE_SCHEMA_VERSION = 2 as const;

export type Pos2CommandType =
  | "CreateOrder" | "AddOrderLine" | "UpdateOrderLineQuantity" | "RemoveOrderLine" | "VoidOrder"
  | "BeginPayment" | "ApplyDiscount" | "ApplyCourtesy" | "CompleteSale" | "CancelSale" | "CreateReturn"
  | "CreateRefund" | "CashIn" | "CashOut" | "CloseCashSession" | "InventoryTransfer";
export type CommandConnectivity = "OFFLINE_DRAFT" | "CONDITIONAL" | "ONLINE_REQUIRED";
export type Pos2QueueStatus = "PENDING" | "SYNCING" | "ACKNOWLEDGED" | "CONFLICT" | "FAILED_PERMANENT";
export type Pos2NetworkState = "ONLINE" | "DEGRADED" | "OFFLINE" | "SYNCING" | "SYNC_ERROR";

export type Pos2CommandEnvelope = {
  schemaVersion: typeof POS2_OFFLINE_SCHEMA_VERSION;
  id: string;
  operationId: string;
  commandType: Pos2CommandType;
  localDraftId: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string;
  dependsOn: string[];
  actorId: string;
  terminalId: string;
  branchId: string;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  status: Pos2QueueStatus;
  lastError: { code: string; message: string; retryable: boolean } | null;
  result: Record<string, unknown> | null;
  acknowledgedAt: string | null;
};

export type Pos2LocalLine = { localLineId: string; productId?: string; variantId?: string; quantity: string; unit: "UNIT" | "ML"; displayName: string; estimatedUnitPrice: string | null };
export type Pos2LocalDraft = {
  schemaVersion: typeof POS2_OFFLINE_SCHEMA_VERSION;
  localDraftId: string; serverOrderId: string | null; serverVersion: number | null; localRevision: number;
  branchId: string; registerId: string; terminalId: string; cashSessionId: string; actorId: string;
  lines: Pos2LocalLine[]; state: "DRAFT" | "SYNC_PENDING" | "SYNCED" | "CONFLICT" | "READY_TO_COMPLETE";
  estimatesOnly: true; cachedAt: string | null; createdAt: string; updatedAt: string;
};

export type Pos2EntityMapping = { localDraftId: string; serverOrderId: string; serverVersion: number; mappedAt: string };
export type Pos2CacheSnapshot<T = unknown> = { key: string; schemaVersion: 2; branchId: string; revision: string; cachedAt: string; data: T };
export type Pos2SyncHealth = { terminalId: string; networkState: Pos2NetworkState; lastSuccessfulSync: string | null; pending: number; conflicts: number; failedPermanent: number; oldestPendingAt: string | null; cachedCatalogAt: string | null; catalogRevision: string | null; retries: number };

export type SyncTransportResult = { ok: true; replayed: boolean; result: Record<string, unknown> } | { ok: false; status: number; code: string; message: string; retryable: boolean };
