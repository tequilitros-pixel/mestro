export const DOMAIN_ERROR_CODES = [
  "INSUFFICIENT_STOCK",
  "PRICE_CHANGED",
  "PROMOTION_CHANGED", "DISCOUNT_NO_LONGER_VALID",
  "PRICE_NOT_CONFIGURED",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_OPEN",
  "ORDER_VERSION_CONFLICT",
  "ORDER_EMPTY",
  "PRODUCT_UNAVAILABLE",
  "INVALID_QUANTITY",
  "CASH_SESSION_NOT_OPEN",
  "ORDER_PAYMENT_PENDING",
  "ORDER_ALREADY_FINALIZED",
  "SALE_ALREADY_CANCELLED", "RETURN_QUANTITY_EXCEEDED", "REFUND_AMOUNT_EXCEEDED",
  "INVENTORY_ITEM_NOT_FOUND", "INVENTORY_NOT_TRACKED", "INVENTORY_UNIT_MISMATCH", "INVENTORY_CONFLICT", "INVALID_INVENTORY_DELTA", "INVENTORY_BALANCE_MISMATCH", "INVENTORY_MAPPING_NOT_CONFIGURED", "RECIPE_UNIT_UNRESOLVED",
  "REGISTER_CLOSED",
  "DUPLICATE_OPERATION",
  "IDEMPOTENCY_KEY_REUSED",
  "PAYMENT_MISMATCH",
  "PERMISSION_DENIED",
  "INVALID_STATE_TRANSITION",
  "CONFLICT",
  "VALIDATION_ERROR",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];
export type SafeMetadata = Record<string, string | number | boolean | null>;

const DEFAULTS: Record<DomainErrorCode, { message: string; retryable: boolean; httpStatus: number }> = {
  INSUFFICIENT_STOCK: { message: "No hay existencias suficientes para completar la operación.", retryable: false, httpStatus: 409 },
  PRICE_CHANGED: { message: "El precio cambió. Revisa la operación antes de continuar.", retryable: false, httpStatus: 409 },
  PROMOTION_CHANGED: { message: "La promoción cambió. Vuelve a revisar la orden.", retryable: false, httpStatus: 409 },
  DISCOUNT_NO_LONGER_VALID: { message: "El descuento ya no es válido. Vuelve a revisar la orden.", retryable: false, httpStatus: 409 },
  PRICE_NOT_CONFIGURED: { message: "No hay un precio configurado para esta fecha y sucursal.", retryable: false, httpStatus: 422 },
  ORDER_NOT_FOUND: { message: "La orden no existe.", retryable: false, httpStatus: 404 },
  ORDER_NOT_OPEN: { message: "La orden ya no está abierta para cambios.", retryable: false, httpStatus: 409 },
  ORDER_VERSION_CONFLICT: { message: "La orden cambió en otra solicitud. Actualiza antes de continuar.", retryable: true, httpStatus: 409 },
  ORDER_EMPTY: { message: "La orden no contiene artículos.", retryable: false, httpStatus: 422 },
  PRODUCT_UNAVAILABLE: { message: "El producto no está disponible en esta sucursal.", retryable: false, httpStatus: 422 },
  INVALID_QUANTITY: { message: "La cantidad no es válida para la unidad del producto.", retryable: false, httpStatus: 422 },
  CASH_SESSION_NOT_OPEN: { message: "La sesión de caja no está abierta.", retryable: false, httpStatus: 409 },
  ORDER_PAYMENT_PENDING: { message: "La orden está congelada para cobro.", retryable: false, httpStatus: 409 },
  ORDER_ALREADY_FINALIZED: { message: "La orden ya fue finalizada.", retryable: false, httpStatus: 409 },
  SALE_ALREADY_CANCELLED: { message: "La venta ya fue cancelada.", retryable: false, httpStatus: 409 },
  RETURN_QUANTITY_EXCEEDED: { message: "La devolución excede la cantidad disponible.", retryable: false, httpStatus: 409 },
  REFUND_AMOUNT_EXCEEDED: { message: "El reembolso excede el importe disponible.", retryable: false, httpStatus: 409 },
  INVENTORY_ITEM_NOT_FOUND: { message: "El artículo físico de inventario no existe.", retryable: false, httpStatus: 404 },
  INVENTORY_NOT_TRACKED: { message: "El artículo no está configurado para Inventory V2.", retryable: false, httpStatus: 422 },
  INVENTORY_UNIT_MISMATCH: { message: "La unidad no coincide con la unidad base del artículo.", retryable: false, httpStatus: 422 },
  INVENTORY_CONFLICT: { message: "El balance de inventario cambió durante la operación.", retryable: true, httpStatus: 409 },
  INVALID_INVENTORY_DELTA: { message: "El movimiento de inventario no tiene una cantidad válida.", retryable: false, httpStatus: 422 },
  INVENTORY_BALANCE_MISMATCH: { message: "El balance no coincide con la suma del ledger.", retryable: false, httpStatus: 409 },
  INVENTORY_MAPPING_NOT_CONFIGURED: { message: "El producto no tiene una receta de inventario configurada.", retryable: false, httpStatus: 422 },
  RECIPE_UNIT_UNRESOLVED: { message: "La receta contiene una unidad de ingrediente sin resolver.", retryable: false, httpStatus: 422 },
  REGISTER_CLOSED: { message: "La caja no está abierta.", retryable: false, httpStatus: 409 },
  DUPLICATE_OPERATION: { message: "La operación ya fue procesada.", retryable: false, httpStatus: 409 },
  IDEMPOTENCY_KEY_REUSED: { message: "El identificador de operación ya se utilizó con otros datos.", retryable: false, httpStatus: 409 },
  PAYMENT_MISMATCH: { message: "Los pagos no coinciden con el total de la operación.", retryable: false, httpStatus: 422 },
  PERMISSION_DENIED: { message: "No tienes permiso para realizar esta operación.", retryable: false, httpStatus: 403 },
  INVALID_STATE_TRANSITION: { message: "La operación no es válida en el estado actual.", retryable: false, httpStatus: 409 },
  CONFLICT: { message: "La operación entra en conflicto con un cambio reciente.", retryable: true, httpStatus: 409 },
  VALIDATION_ERROR: { message: "Los datos proporcionados no son válidos.", retryable: false, httpStatus: 422 },
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly metadata: SafeMetadata;

  constructor(code: DomainErrorCode, metadata: SafeMetadata = {}, safeMessage?: string) {
    const definition = DEFAULTS[code];
    super(safeMessage ?? definition.message);
    this.name = "DomainError";
    this.code = code;
    this.retryable = definition.retryable;
    this.httpStatus = definition.httpStatus;
    this.metadata = Object.freeze({ ...metadata });
  }

  toResponse(operationId?: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(operationId ? { operationId } : {}),
        ...(Object.keys(this.metadata).length ? { metadata: this.metadata } : {}),
      },
    };
  }
}
