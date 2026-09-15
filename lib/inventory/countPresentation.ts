import { getInventoryCaptureInputValue } from "@/lib/inventory/units";

type DecimalLike = number | string | { toString(): string };

export type InventoryCountItemRecord = {
  id: string;
  quantityCounted: DecimalLike | null;
  countedAt: Date | null;
  previousQuantity: DecimalLike | null;
  entriesQuantity: DecimalLike | null;
  quantityConsumed: DecimalLike | null;
  costTotal: DecimalLike | null;
  product: {
    name: string;
    unit: string;
    inventoryBaseUnit: string | null;
    handlingUnit: string | null;
    contentPerUnit: DecimalLike | null;
    contentUnit: string | null;
    normalizedContentPerUnit: DecimalLike | null;
  };
};

export type InventoryCountItemClientView = {
  id: string;
  productName: string;
  unit: string;
  inventoryBaseUnit: string | null;
  handlingUnit: string | null;
  contentPerUnit: number | null;
  contentUnit: string | null;
  normalizedContentPerUnit: number | null;
  quantityCounted: number;
  isCaptured: boolean;
  previousQuantity?: number;
  entriesQuantity?: number | null;
  quantityConsumed?: number | null;
  costTotal?: number | null;
};

function asNumber(value: DecimalLike): number;
function asNumber(value: DecimalLike | null): number | null;
function asNumber(value: DecimalLike | null): number | null {
  return value === null ? null : Number(value);
}

export function buildInventoryCountItemClientView(
  item: InventoryCountItemRecord,
  options: { status: "BORRADOR" | "CERRADO"; canViewHistory: boolean },
): InventoryCountItemClientView {
  const view: InventoryCountItemClientView = {
    id: item.id,
    productName: item.product.name,
    unit: item.product.unit,
    inventoryBaseUnit: item.product.inventoryBaseUnit,
    handlingUnit: item.product.handlingUnit,
    contentPerUnit: asNumber(item.product.contentPerUnit),
    contentUnit: item.product.contentUnit,
    normalizedContentPerUnit: asNumber(item.product.normalizedContentPerUnit),
    quantityCounted: asNumber(item.quantityCounted ?? 0),
    isCaptured: options.status === "CERRADO" || item.countedAt !== null,
  };

  if (options.status !== "CERRADO" || !options.canViewHistory) return view;

  return {
    ...view,
    previousQuantity: asNumber(item.previousQuantity ?? 0),
    entriesQuantity: asNumber(item.entriesQuantity),
    quantityConsumed: asNumber(item.quantityConsumed),
    costTotal: asNumber(item.costTotal),
  };
}

export function getInventoryCountInputValue(item: InventoryCountItemClientView) {
  if (!item.isCaptured) return "";
  return getInventoryCaptureInputValue(item.quantityCounted, item);
}
