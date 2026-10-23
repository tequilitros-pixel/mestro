import type { CommandConnectivity, Pos2CommandType } from "./types";

export const POS2_COMMAND_POLICY: Record<Pos2CommandType, CommandConnectivity> = {
  CreateOrder: "OFFLINE_DRAFT", AddOrderLine: "OFFLINE_DRAFT", UpdateOrderLineQuantity: "OFFLINE_DRAFT", RemoveOrderLine: "OFFLINE_DRAFT", VoidOrder: "CONDITIONAL",
  BeginPayment: "ONLINE_REQUIRED", ApplyDiscount: "ONLINE_REQUIRED", ApplyCourtesy: "ONLINE_REQUIRED", CompleteSale: "ONLINE_REQUIRED", CancelSale: "ONLINE_REQUIRED", CreateReturn: "ONLINE_REQUIRED", CreateRefund: "ONLINE_REQUIRED",
  CashIn: "ONLINE_REQUIRED", CashOut: "ONLINE_REQUIRED", CloseCashSession: "ONLINE_REQUIRED", InventoryTransfer: "ONLINE_REQUIRED",
};

export function canQueueOffline(command: Pos2CommandType) { return POS2_COMMAND_POLICY[command] === "OFFLINE_DRAFT"; }
export function requiresOnline(command: Pos2CommandType) { return POS2_COMMAND_POLICY[command] === "ONLINE_REQUIRED"; }

export const USER_CONFLICT_CODES = new Set(["ORDER_VERSION_CONFLICT", "PRICE_CHANGED", "PROMOTION_CHANGED", "DISCOUNT_NO_LONGER_VALID", "PRODUCT_UNAVAILABLE", "CASH_SESSION_NOT_OPEN", "INSUFFICIENT_STOCK", "ORDER_ALREADY_FINALIZED", "ORDER_NOT_OPEN", "PERMISSION_DENIED"]);
export function classifySyncFailure(status: number, code: string) {
  if (USER_CONFLICT_CODES.has(code)) return { retryable: false, status: "CONFLICT" as const };
  if (status === 401 || status === 403) return { retryable: false, status: "CONFLICT" as const };
  if (status === 408 || status === 425 || status === 429 || status >= 500) return { retryable: true, status: "PENDING" as const };
  return { retryable: false, status: "FAILED_PERMANENT" as const };
}
