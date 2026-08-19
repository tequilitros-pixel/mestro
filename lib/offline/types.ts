export type OfflineOperationStatus = "pending" | "syncing" | "failed";

export type CookingEventPayload = {
  cookingId: string;
  type: string;
  temperatureTop?: number | null;
  temperatureMiddle?: number | null;
  temperatureBottom?: number | null;
  liters?: number | null;
  ph?: number | null;
  brix?: number | null;
  temperature?: number | null;
  notes?: string | null;
};

export type OfflineOperation = {
  id: string;
  kind:
    | "cooking.event.create"
    | "milling.discharge.create"
    | "fermentation.reading.create"
    | "distillation.event.create"
    | "pos.sale.create"
    | "timeclock.clock-in"
    | "timeclock.clock-out"
    | "cash-cut.open"
    | "cash-cut.inflow.create"
    | "cash-cut.outflow.create"
    | "cash-cut.close"
    | "cash-cut.venta.set";
  payload: CookingEventPayload | Record<string, unknown>;
  createdAt: string;
  attempts: number;
  status: OfflineOperationStatus;
  lastError?: string;
};

export type SyncSnapshot = {
  online: boolean;
  pending: number;
  syncing: boolean;
  failed: number;
  lastSyncedAt: string | null;
};
