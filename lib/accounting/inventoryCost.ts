type CostedInventoryProduct = {
  unitCost: unknown;
  inventoryBaseUnit?: unknown;
  normalizedContentPerUnit?: unknown;
};

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Inventory V2 moves ml, g or individual units. Product cost, however, is
 * captured for its commercial presentation (for example a 750 ml bottle).
 * Convert that presentation cost only when the movement is in the base unit.
 */
export function costPerInventoryBaseUnit(product: CostedInventoryProduct) {
  const unitCost = positiveNumber(product.unitCost);
  if (unitCost === null) return null;

  const baseUnit = typeof product.inventoryBaseUnit === "string" ? product.inventoryBaseUnit : "";
  const content = positiveNumber(product.normalizedContentPerUnit);
  return baseUnit && content !== null ? unitCost / content : unitCost;
}

/**
 * En los conteos antiguos unitCostAtTime está expresado por ML/G/UNIT, pero
 * algunos cierres recientes lo guardaron accidentalmente por presentación.
 * Distinguir ambos formatos sin reescribir el historial.
 */
export function resolveInventoryCountUnitCost(
  product: CostedInventoryProduct,
  storedCostAtTime: unknown,
): { unitCost: number; snapshotInPresentation: boolean; missingCost: boolean } {
  const current = costPerInventoryBaseUnit(product);
  const stored = positiveNumber(storedCostAtTime);
  const factor = positiveNumber(product.normalizedContentPerUnit);
  const commercialCost = positiveNumber(product.unitCost);
  if (stored === null) {
    return { unitCost: current ?? 0, snapshotInPresentation: false, missingCost: current === null };
  }

  const presentationSnapshot = factor !== null && factor > 1 && commercialCost !== null
    && Math.abs(stored - commercialCost) <= Math.max(0.000001, commercialCost * 0.000001);
  if (presentationSnapshot) {
    return { unitCost: stored / factor!, snapshotInPresentation: true, missingCost: false };
  }

  // Los snapshots antiguos tienen 4 decimales (0.0167 por ml). Si el precio
  // comercial no cambió, recuperar la precisión del factor 30 / 1800.
  if (current !== null && Math.abs(stored - current) <= Math.max(0.00005, current * 0.001)) {
    return { unitCost: current, snapshotInPresentation: false, missingCost: false };
  }
  return { unitCost: stored, snapshotInPresentation: false, missingCost: false };
}

import { formatHumanInventoryQuantity } from "../inventory/units";

export function inventoryBaseUnitLabel(value: unknown, fallback: string) {
  if (value === "ML") return "ml";
  if (value === "G") return "g";
  if (value === "UNIT") return "unidad";
  return fallback;
}

/**
 * Convierte medidas en unidades base (gramos, mililitros) a escalas comprensibles para
 * humanos (kg, L) cuando el volumen supera o iguala 1,000 unidades.
 * Por ejemplo: 10,000 g -> "10 kg", -10,000 g -> "−10 kg", 45,000 ml -> "45 L", 750 ml -> "750 ml".
 */
export const formatHumanQuantity = formatHumanInventoryQuantity;
export const formatReadableMeasure = formatHumanInventoryQuantity;
