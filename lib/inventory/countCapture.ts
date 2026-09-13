import { Prisma } from "@prisma/client";
import {
  getNormalizedContentPerUnit,
  type InventoryCaptureUnit,
  type InventoryProductUnitConfig,
} from "@/lib/inventory/units";

export type InventoryCountCaptureProduct = InventoryProductUnitConfig & {
  isActive: boolean;
  trackStock: boolean;
};

export type NormalizedInventoryCountCapture = {
  captureUnit: InventoryCaptureUnit;
  capturedQuantity: Prisma.Decimal;
  baseQuantity: Prisma.Decimal;
  baseUnit: string;
};

const MAX_COUNT_QUANTITY = new Prisma.Decimal("999999999.999");
const DECIMAL_INPUT = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseNonNegativeQuantity(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("COUNT_QUANTITY_REQUIRED");
  }

  const raw = value.trim();
  if (!DECIMAL_INPUT.test(raw)) throw new Error("COUNT_QUANTITY_INVALID");

  const quantity = new Prisma.Decimal(raw);
  if (!quantity.isFinite() || quantity.isNegative()) {
    throw new Error("COUNT_QUANTITY_INVALID");
  }
  if (quantity.decimalPlaces() > 3) throw new Error("COUNT_QUANTITY_PRECISION");
  return quantity;
}

function validateBaseQuantity(quantity: Prisma.Decimal) {
  if (quantity.isNegative() || quantity.decimalPlaces() > 3 || quantity.gt(MAX_COUNT_QUANTITY)) {
    throw new Error("COUNT_QUANTITY_INVALID");
  }
}

export function normalizeInventoryCountCapture(input: {
  quantity: unknown;
  captureUnit: InventoryCaptureUnit;
  product: InventoryCountCaptureProduct;
}): NormalizedInventoryCountCapture {
  const { product } = input;
  if (!product.isActive || !product.trackStock || !product.inventoryBaseUnit) {
    throw new Error("INVENTORY_NOT_TRACKED");
  }

  const capturedQuantity = parseNonNegativeQuantity(input.quantity);
  let baseQuantity = capturedQuantity;

  if (input.captureUnit === "PRESENTATION") {
    const factor = getNormalizedContentPerUnit(product);
    if (factor === null) throw new Error("PRESENTATION_NOT_CONFIGURED");
    baseQuantity = capturedQuantity.times(new Prisma.Decimal(factor.toString()));
  } else if (input.captureUnit !== "BASE") {
    throw new Error("COUNT_CAPTURE_UNIT_INVALID");
  }

  validateBaseQuantity(baseQuantity);

  return {
    captureUnit: input.captureUnit,
    capturedQuantity,
    baseQuantity,
    baseUnit: product.inventoryBaseUnit,
  };
}
